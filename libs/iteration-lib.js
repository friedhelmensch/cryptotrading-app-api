import * as dynamoDbLib from './dynamodb-lib';
import { success, failure } from './response-lib';
import KrakenClient from './kraken-lib';

export async function executeForAll(doTheTrading, callback) {

    try {
        const params = { TableName: 'profiles' };
        const profilesResult = await dynamoDbLib.call('scan', params);
        var profiles = profilesResult.Items;

        for (var i = 0; i < profiles.length ; i++) {

            var profile = profiles[i];

            var settingsParams = {
                TableName: "settings",
                KeyConditionExpression: "userId = :userId",
                ExpressionAttributeValues: { ":userId": profile.userId }
            };

            var kraken = new KrakenClient(profile.apiKey, profile.apiSecret);
            const settingsResult = await dynamoDbLib.call('query', settingsParams);

            var settings = settingsResult.Items;

            for (var i = 0; i< settings.length; i++) {
                var setting = settings[i];

                try {
                    var euroToInvest = setting.amount;
                    var pair = setting.currency;
                    await doTheTrading(kraken, pair, euroToInvest);

                } catch (e) {
                    console.error("trading went wrong for user: " + profile.userId + " " + e);
                }
            }
        }
        callback(null, success(true));
    }
    catch (e) {
        console.error("function failed: " + e);
        callback(null, failure({ status: false }));
    }
}