import * as dynamoDbLib from './libs/dynamodb-lib';
import { success, failure } from './libs/response-lib';
import uuid from 'uuid';

export async function main(event, context, callback) {
  // Request body is passed in as a JSON encoded string in 'event.body'
  const data = JSON.parse(event.body);

  const params = {
    TableName: 'settings',
    Item: {
      userId: event.requestContext.identity.cognitoIdentityId,
      settingId: uuid.v1(),
      currency: data.currency,
      amount : data.amount,
      createdAt: new Date().getTime(),
    },
  };
  
    try {
    const result = await dynamoDbLib.call('put', params);
    callback(null, success(params.Item));
  }
  catch(e) {
    callback(null, failure({status: false}));
  }
};