import * as dynamoDbLib from './libs/dynamodb-lib';
import { success, failure } from './libs/response-lib';

export async function main(event, context, callback) {
  const data = JSON.parse(event.body);

  const params = {
    TableName: 'profiles',
    Item: {
      userId: event.requestContext.identity.cognitoIdentityId,
      apiKey: data.apiKey,
      apiSecret : data.apiSecret,
      spread : data.spread,
      buyFactor : data.buyFactor,
      targetProfit : data.targetProfit,
      euroLimit : data.euroLimit,
      active : true,
      createdAt: new Date().getTime(),
    },
  };

  try {
    const result = await dynamoDbLib.call('put', params);
    callback(null, success({ status: true }));
  }
  catch (e) {
    callback(null, failure({ status: e }));
  }
};