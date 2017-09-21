import * as dynamoDbLib from './libs/dynamodb-lib';
import { success, failure } from './libs/response-lib';

export async function main(event, context, callback) {
  const params = {
    TableName: 'profiles',
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": event.requestContext.identity.cognitoIdentityId,
    }
  };

  try {
    const result = await dynamoDbLib.call('query', params);
    const profile = result.Items[0];
    if (profile) {
      
      var apiKey = null;
      var apiSecret = null;
      if (profile.apiKey && profile.apiSecret) {
        apiKey = profile.apiKey.substring(0, 5) + "*********************";
        apiSecret = profile.apiSecret.substring(0, 5) + "*********************"
      }
      else {
        apiKey = "invalid";
        apiSecret = "invalid";
      }

      var returnValue = {
        apiKey: apiKey,
        apiSecret: apiSecret,
        active: profile.active
      }
      callback(null, success(returnValue));
    } else {
      callback(null, success({}));
    }

  }
  catch (e) {
    callback(null, failure({ status: false }));
  }
};