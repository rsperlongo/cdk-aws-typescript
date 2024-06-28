import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { Product, ProductRepository } from "/opt/nodejs/productsLayer";
import { DynamoDB, Lambda } from "aws-sdk";
import { ProductEvent, ProductEventType } from "/opt/nodejs/productEventsLayer";
import * as AWSXRay from 'aws-xray-sdk'

AWSXRay.captureAWS(require('aws-sdk'))

const productsDdb = process.env.PRODUCTS_DDB!;
const productEventsFunctionName = process.env.PRODUCTS_EVENTS_FUNCTION_NAME!;
const ddbClient = new DynamoDB.DocumentClient();
const lambdaClient = new Lambda()

const productsRepository = new ProductRepository(ddbClient, productsDdb);

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const lambdaRequestId = context.awsRequestId;
  const apiRequestId = event.requestContext.requestId;
  console.log(
    `API Gateway RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`
  );

  if (event.resource === "/products") {
    console.log("POST /products");

    const product = JSON.parse(event.body!) as Product;
    const productCreated = await productsRepository.create(product);

    const response = await sendProductEvent(productCreated, ProductEventType.CREATED, 'matilde@weblifebrasil.com.br', lambdaRequestId)
    console.log(response)
    return {
      statusCode: 201,
      body: JSON.stringify(productCreated),
    };
  } else if (event.resource === "/products/{id}") {
    const productId = event.pathParameters!.id as string;
    if (event.httpMethod === "PUT") {
      console.log(`PUT /products/${productId}`);

      const product = JSON.parse(event.body!) as Product
      try {
        const productUpdated = await productsRepository.updateProduct(productId, product) 

        const response = await sendProductEvent(productUpdated, ProductEventType.UPDATED, 'ricardo@weblifebrasil.com.br', lambdaRequestId)
        console.log(response)
        return {
          statusCode: 200,
          body: JSON.stringify(productUpdated),
        }
      } catch (ConditionalCheckFailException) {
        return {
          statusCode: 400,
          body: 'Product not found'
        }
      }

      function sendProductEvent(product: Product, eventType: ProductEventType, email: string, lambdaRequestId: string ) {
        const event: ProductEvent = {
          email: email,
          eventType: eventType,
          productCode: product.code,
          productId: product.id,
          productPrice: product.price,
          requestId: lambdaRequestId
        }
        lambdaClient.invoke({
          FunctionName: productEventsFunctionName,
          Payload: JSON.stringify(event),
          InvocationType: 'RequestResponse'
        }).promise()
      }
      
    } else if (event.httpMethod === "DELETE") {
      console.log(`DELETE /products/${productId}`);

      try {
        const product = await productsRepository.deleteProduct(productId);
        const response = await sendProductEvent(product, ProductEventType.DELETED, 'hannah@weblifebrasil.com.br', lambdaRequestId)
        console.log(response)
        return {
          statusCode: 200,
          body: JSON.stringify(product),
        };
      } catch (error) {
        console.error((<Error>error).message);
        return {
          statusCode: 404,
          body: (<Error>error).message,
        };
      }
    }
  }

  return {
    statusCode: 400,
    body: "Bad Request",
  };
}
function sendProductEvent(productCreated: Product, CREATED: ProductEventType, arg2: string, lambdaRequestId: string) {
  throw new Error("Function not implemented.");
}

