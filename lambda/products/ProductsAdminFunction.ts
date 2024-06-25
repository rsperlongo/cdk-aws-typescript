import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { Product, ProductRepository } from "/opt/nodejs/productsLayer";
import { DynamoDB } from "aws-sdk";

const productsDdb = process.env.PRODUCTS_DDB!;
const ddbCliente = new DynamoDB.DocumentClient();

const productsRepository = new ProductRepository(ddbCliente, productsDdb);

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
          
      
    } else if (event.httpMethod === "DELETE") {
      console.log(`DELETE /products/${productId}`);

      try {
        const product = await productsRepository.deleteProduct(productId);
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
