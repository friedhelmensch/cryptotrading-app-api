import * as dynamoDbLib from './libs/dynamodb-lib';
import { success, failure } from './libs/response-lib';
import crypto from 'crypto';

//const allowedIp = "123.123.123.123";

export async function main(event, context, callback) {

  /*if(event.requestContext.identity.sourceIp != allowedIp){
    callback(null, failure("Not allowed"));
    return;
  }*/  

  const tradeInfos = await getTradeInfosFromDatabase();
  callback(null, success(tradeInfos));

};

async function getTradeInfosFromDatabase() {

  var tradeInfos = [];
  const params = {
    TableName: 'profiles'
  };

  const profilesResult = await dynamoDbLib.call('scan', params);
  const profiles = profilesResult.Items;

  for (var i = 0; i < profiles.length; i++) {

    var profile = profiles[i];

    var settingsParams = {
      TableName: "settings",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": profile.userId }
    };

   const settingsResult = await dynamoDbLib.call('query', settingsParams);
    
    var settings = settingsResult.Items;
    
    var orderInfos = [];

    if (profile.active) {
      for (var j = 0; j < settings.length; j++) {
        var setting = settings[j];

        var orderInfo = {
          euroToInvest: setting.amount,
          pair: setting.currency
        }
        orderInfos.push(orderInfo);
      }
    }

    var hashedUserId = crypto.createHash('md5').update(profile.userId).digest("hex");

    var tradeInfo = {
      userId : hashedUserId,
      apiKey: profile.apiKey,
      apiSecret: profile.apiSecret,
      spread : profile.spread,
      buyFactor : profile.buyFactor,
      targetProfit : profile.targetProfit,
      euroLimit : profile.euroLimit,
      orderInfos: orderInfos
    }
    
    tradeInfos.push(tradeInfo);
  }
  return tradeInfos;
}
