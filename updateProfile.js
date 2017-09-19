import * as dynamoDbLib from './libs/dynamodb-lib';
import { success, failure } from './libs/response-lib';

export async function main(event, context, callback) {
  const data = JSON.parse(event.body);

  var params = null;

  if (data.apiKey && data.apiSecret) {
    params = {
      TableName: 'profiles',
      Key: {
        userId: event.requestContext.identity.cognitoIdentityId
      },

      UpdateExpression: 'SET apiKey = :apiKey, apiSecret = :apiSecret , active = :active',
      ExpressionAttributeValues: {
        ':apiKey': data.apiKey,
        ':apiSecret': data.apiSecret,
        ':active' : true
      },
      ReturnValues: 'ALL_NEW',
    };
  } else {
    params = {
      TableName: 'profiles',
      Key: {
        userId: event.requestContext.identity.cognitoIdentityId
      },
      UpdateExpression: 'SET active = :active',
      ExpressionAttributeValues: {
        ':active': data.active
      },
      ReturnValues: 'ALL_NEW',
    };
  }

  try {
    const result = await dynamoDbLib.call('update', params);
    callback(null, success({ status: true }));
  }
  catch (e) {
    callback(null, failure({ status: e }));
  }
};