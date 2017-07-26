import * as dynamoDbLib from './libs/dynamodb-lib';
import { success, failure } from './libs/response-lib';

export async function main(event, context, callback) {
  const data = JSON.parse(event.body);
  const params = {
    TableName: 'settings',
    Key: {
      userId: event.requestContext.identity.cognitoIdentityId,
      settingId: event.pathParameters.id,
    },
    // 'UpdateExpression' defines the attributes to be updated
    // 'ExpressionAttributeValues' defines the value in the update expression
    UpdateExpression: 'SET apiKey = :apiKey, currency = :currency, amount = :amount',
    ExpressionAttributeValues: {
      ':apiKey': data.apiKey,
      ':currency': data.currency,
      ':amount': data.amount,
    },
    ReturnValues: 'ALL_NEW',
  };

  try {
    const result = await dynamoDbLib.call('update', params);
    callback(null, success({status: true}));
  }
  catch(e) {
    callback(null, failure({status: e}));
  }
};