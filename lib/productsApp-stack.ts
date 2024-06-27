import * as lambda from "aws-cdk-lib/aws-lambda";

import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs";

import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import * as ssm from "aws-cdk-lib/aws-ssm";

interface ProductsAppStackProps extends cdk.StackProps {
  eventsDdb: dynamodb.Table;
}
export class ProductsAppStack extends cdk.Stack {
  readonly productsFetchHandler: lambdaNodeJS.NodejsFunction;
  readonly productsAdminHandler: lambdaNodeJS.NodejsFunction;
  readonly productsDdb: dynamodb.Table;

  constructor(scopo: Construct, id: string, props: ProductsAppStackProps) {
    super(scopo, id, props);

    this.productsDdb = new dynamodb.Table(this, "ProductsDdB", {
      tableName: "products",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1,
    });

    //Products Layer
    const productsLayerArn = ssm.StringParameter.valueForStringParameter(
      this,
      "ProductsLayerVersionArn"
    );
    const productsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "ProductsLayerVersionArn",
      productsLayerArn
    );

    //Product Events Layer
    const productEventsLayerArn = ssm.StringParameter.valueForStringParameter(
      this,
      "productEventsLayerVersionArn"
    );
    const productEventsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "productEventsLayerVersionArn",
      productEventsLayerArn
    );




    const productEventsHandler =  new lambdaNodeJS.NodejsFunction(
        this,
        "ProductsEventFunction",
        {
          runtime: lambda.Runtime.NODEJS_20_X,
          memorySize: 512,
          functionName: "ProductsEventFunction",
          entry: "lambda/products/ProductsEventFunction.ts",
          handler: "handler",
          timeout: cdk.Duration.seconds(5),
          bundling: {
            minify: true,
            sourceMap: false,
          },
          environment: {
            EVENTS_DDB: props.eventsDdb.tableName,
          },
          layers: [productEventsLayer, productsLayer],
          tracing: lambda.Tracing.ACTIVE,
          insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0,
        }
      )
      props.eventsDdb.grantWriteData(productEventsHandler);


    this.productsFetchHandler = new lambdaNodeJS.NodejsFunction(
      this,
      "ProductsFetchFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 512,
        functionName: "ProductsFetchFunction",
        entry: "lambda/products/ProductsFetchFunction.ts",
        handler: "handler",
        timeout: cdk.Duration.seconds(10),
        bundling: {
          minify: true,
          sourceMap: false,
        },
        environment: {
          PRODUCTS_DDB: this.productsDdb.tableName,
        },
        layers: [productsLayer],
        tracing: lambda.Tracing.ACTIVE,
        insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0,
      }
    );

    this.productsDdb.grantReadData(this.productsFetchHandler);

    this.productsAdminHandler = new lambdaNodeJS.NodejsFunction(
      this,
      "ProductsAdminFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 512,
        functionName: "ProductsAdminFunction",
        entry: "lambda/products/ProductsAdminFunction.ts",
        handler: "handler",
        timeout: cdk.Duration.seconds(10),
        bundling: {
          minify: true,
          sourceMap: false,
        },
        environment: {
          PRODUCTS_DDB: this.productsDdb.tableName,
          PRODUCTS_EVENTS_FUNCTION_NAME: productEventsHandler.functionName
        },
        layers: [productsLayer],
        tracing: lambda.Tracing.ACTIVE,
        insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0,
      }
    );
    this.productsDdb.grantWriteData(this.productsAdminHandler);
    productEventsHandler.grantInvoke(this.productsAdminHandler)
  }
}
