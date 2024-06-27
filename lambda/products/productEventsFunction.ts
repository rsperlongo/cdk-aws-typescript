import * as AWSXRay from 'aws-xray-sdk';
import { Callback, Context } from "aws-lambda";
import { ProductEvent } from "./layers/productsLayer/nodejs/productEventsLayer/nodejs/productEvent";
import { DynamoDB } from "aws-sdk";

AWSXRay.captureAWS(require("aws-sdk"))

const eventsDdb = process.env.EVENTS_DDB!;
const ddbCliente = new DynamoDB.DocumentClient()

export async function handler(event: ProductEvent, context: Context, callback: Callback): Promise<void> {
    console.log(event)

    console.log(`lambda requestId: ${context.awsRequestId}`)
}

function createEvent(event: ProductEvent) {
    
}