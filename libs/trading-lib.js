import KrakenClient from './kraken-lib';
import * as dynamoDbLib from './dynamodb-lib';

export async function trade(getCandle, signal, factor, targetProfit, expirationHours) {

    var tradeInfos = await getTradeInfosFromDatabase();

    for (var i = 0; i < tradeInfos.length; i++) {
        var tradeInfo = tradeInfos[i];
        var kraken = new KrakenClient(tradeInfo.apiKey, tradeInfo.apiSecret);

        for (var j = 0; j < tradeInfo.orderInfos.length; j++) {

            var orderInfo = tradeInfo.orderInfos[j];

            var candle = await getCandle(kraken, orderInfo.pair);
            var placeOrder = shouldPlaceOrder(candle, signal, factor);

            if (placeOrder) {

                var tickerResult = await kraken.api('Ticker', { pair: orderInfo.pair });
                var ask = Number(tickerResult.result[orderInfo.pair]['a'][0]);
                var bid = Number(tickerResult.result[orderInfo.pair]['b'][0]);

                var assetPairs = await kraken.api('AssetPairs');
                var decimals = assetPairs.result[orderInfo.pair]. _decimals;

                var order = createOrder(ask, bid, orderInfo.euroToInvest, orderInfo.pair, decimals, targetProfit, expirationHours);

                console.log("Placing order: " + orderInfo.pair + " for: " + orderInfo.euroToInvest + " EUR");
                await kraken.api('AddOrder', order);
                console.log("Order placed. buy: " + orderInfo.pair + " for: " + orderInfo.euroToInvest + " EUR");
            }
        }
    }
}

async function getTradeInfosFromDatabase() {

    var tradeInfos = [];
    const params = { 
        TableName: 'profiles',
        FilterExpression: "active = :active",
        ExpressionAttributeValues: { ":active": true }};

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

        for (var i = 0; i < settings.length; i++) {
            var setting = settings[i];

            var orderInfo = {
                euroToInvest: setting.amount,
                pair: setting.currency
            }
            orderInfos.push(orderInfo);
        }

        var tradeInfo = {
            apiKey: profile.apiKey,
            apiSecret: profile.apiSecret,
            orderInfos: orderInfos
        }

        tradeInfos.push(tradeInfo);
    }
    return tradeInfos;
}

function shouldPlaceOrder(candle, signal, factor) {

    const low_gap = Math.abs(((candle.close / candle.low) - 1) * 100);
    const high_gap = Math.abs(((candle.close / candle.high) - 1) * 100);
    const spread = low_gap + high_gap;
    const factored_high_gap = high_gap * factor;

    if (spread > signal) {
        if (factored_high_gap > spread) {
            return true;
        }
    }
    console.log("Order NOT placed for: " + candle.pair + " spread: " + spread.toFixed(2) + " signal: " + signal + " factored_high_gap: " + factored_high_gap.toFixed(2) + " high " + candle.high.toFixed(2) + " low " + candle.low.toFixed(2) + " close " + candle.close.toFixed(2) + " low_gap " + low_gap.toFixed(2) + " high_gap " + high_gap.toFixed(2));
    return false;
}

function createOrder(ask, bid, euro, pair, decimals, targetProfit, expirationHours) {
    //kraken has different decimal precision per pair, so we need to truncate the price accordingly
    var price = (((ask + bid) / 2).toFixed(decimals));
    var expire = ((new Date().getTime() + (expirationHours * 60 * 60 * 1000)) / 1000).toFixed(0); //half hour
    var volume = euro / price;

    const closingPrice = '#' + targetProfit + '%';

    var order = {
        trading_agreement: 'agree',
        pair: pair,
        type: 'buy',
        ordertype: 'limit',
        price: price,
        volume: volume,
        expiretm: expire,
        close: {
            ordertype: 'limit',
            price: closingPrice
        }
    };
    
    return order
}
