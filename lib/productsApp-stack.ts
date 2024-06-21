import * as lambda from 'aws-cdk-lib/aws-lambda'

import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'

import * as cdk from 'aws-cdk-lib'
import * as dynadb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'
import * as ssm from 'aws-cdk-lib/aws-ssm'

export class ProductsAppStack extends cdk.Stack {
    readonly productsFetchHandler: lambdaNodeJS.NodejsFunction
    readonly productsAdminHandler: lambdaNodeJS.NodejsFunction
    readonly productsDdb: dynadb.Table


    constructor(scopo: Construct, id: string, props?: cdk.StackProps) {
        super(scopo, id, props)

        this.productsDdb = new dynadb.Table(this, 'ProductsDdB', {
            tableName: 'products',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            partitionKey: {
                name: 'id',
                type: dynadb.AttributeType.STRING
            },
            billingMode: dynadb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1
        })

        //Products Layer
        const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsLayerVersionArn')
        const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsLayerVersionArn', productsLayerArn)
        this.productsFetchHandler = new lambdaNodeJS.NodejsFunction(this, 'ProductsFetchFunction', {
            runtime: lambda.Runtime.NODEJS_20_X,
            memorySize: 512,
            functionName: 'ProductsFetchFunction',
            entry: 'lambda/products/ProductsFetchFunction.ts',
            handler: 'handler',
            timeout: cdk.Duration.seconds(10),
            bundling: {
                minify: true,
                sourceMap: false
            },
            environment: {
                PRODUCTS_DDB: this.productsDdb.tableName
            },
            layers: [productsLayer]
        })

        this.productsDdb.grantReadData(this.productsFetchHandler)

        this.productsAdminHandler = new lambdaNodeJS.NodejsFunction(this, 'ProductsAdminFunction', {
            runtime: lambda.Runtime.NODEJS_20_X,
            memorySize: 512,
            functionName: 'ProductsAdminFunction',
            entry: 'lambda/products/ProductsAdminFunction.ts',
            handler: 'handler',
            timeout: cdk.Duration.seconds(10),
            bundling: {
                minify: true,
                sourceMap: false
            },
            environment: {
                PRODUCTS_DDB: this.productsDdb.tableName
            },
            layers: [productsLayer]
        })
        this.productsDdb.grantWriteData(this.productsAdminHandler)
    }
}