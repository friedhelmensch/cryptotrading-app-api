import { executeForAll } from './libs/iteration-lib';

var lastReqId;

export async function main(event, context, callback) {
    
    // We check if the lambda is being retried.
    // If that's the case, we kill it
    // We leverage lambda's quirks:
    // - lambda's node process reuse which keeps vars instanced
    // - retried lambdas have the same request id 
    // Hopefully Amazon will someday allow us to disable autoretries
    // https://forums.aws.amazon.com/thread.jspa?threadID=176074
    if (lastReqId == context.awsRequestId) {
        console.log('Lambda auto retry detected. Aborting.');
        callback(null, success(true));
        return context.succeed();
    } else {
        lastReqId = context.awsRequestId;
    };

    executeForAll(doTheTrading, callback);
};

async function doTheTrading(kraken, pair, euroToInvest) {

    const factor = 1.7;
    const signal = 6;
    const euroLimit = 0;

    var balanceResult = await kraken.api('Balance');
    var hasEnoughMoney = checkSufficientBalance(balanceResult, euroLimit);
    if (!hasEnoughMoney) {
        console.log("not enough money");
        return;
    }

    var tickerResponse = await kraken.api('Ticker', { pair: pair });
    var candle = getCandle(tickerResponse, pair);
    var placeOrder = shouldPlaceOrder(candle, signal, factor);

    if (placeOrder) {
        var tickerResult = await kraken.api('Ticker', { pair: pair });

        var ask = Number(tickerResult.result[pair]['a'][0]);
        var bid = Number(tickerResult.result[pair]['b'][0]);

        var assetPairsResponse = await kraken.api('AssetPairs');
        var decimals = assetPairsResponse.result[pair].pair_decimals;

        console.log("Placing order: " + pair + " for: " + euroToInvest + " EUR");
        var order = createOrder(ask, bid, euroToInvest, pair, decimals);
        await kraken.api('AddOrder', order);
        console.log("Order placed. buy: " + pair + " for: " + euroToInvest + " EUR")
    }
}

function checkSufficientBalance(result, euroLimit) {
    var euroInAccount = result.result['ZEUR'];
    return euroInAccount > euroLimit;
}

function getCandle(response, pair)
{
    const result = response.result[pair];
    // * 1 to convert string to number
    const high = result['h'][1] * 1;
    const low = result['l'][1] * 1;
    const close = result['c'][0] * 1;
    
    return {high: high, low : low, close: close, pair : pair }
}

function shouldPlaceOrder(candle, signal, factor)
{
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

function createOrder(ask, bid, euro, pair, decimals) {
    //kraken has different decimal precision per pair, so we need to truncate the price accordingly
    var price = ((ask + bid) / 2).toFixed(decimals);
    var expire = ((new Date().getTime() + (3.5 * 60 * 60 * 1000)) / 1000).toFixed(0); //3.5 h
    var volume = euro / price;

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
            price: '#7%'
        }
    };
    return order
}
