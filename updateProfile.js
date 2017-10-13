import * as dynamoDbLib from './libs/dynamodb-lib';
import { success, failure } from './libs/response-lib';

export async function main(event, context, callback) {
  const data = JSON.parse(event.body);

  const params = {
    TableName: 'profiles',
    Key: {
      userId: event.requestContext.identity.cognitoIdentityId
    },
    UpdateExpression: 'SET spread = :spread, buyFactor = :buyFactor, targetProfit = :targetProfit, euroLimit = :euroLimit, active = :active',
    ExpressionAttributeValues: {
      ':spread': data.spread,
      ':buyFactor': data.buyFactor,
      ':targetProfit': data.targetProfit,
      ':euroLimit': data.euroLimit,
      ':active': data.active
    },
    ReturnValues: 'ALL_NEW',
  };

  try {
    const result = await dynamoDbLib.call('update', params);
    callback(null, success({ status: true }));
  }
  catch (e) {
    console.log(e);
    callback(null, failure({ status: e }));
  }
};