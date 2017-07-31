import KrakenClient from 'kraken-api';

export async function main(event, context, callback) {

    const apiKey = 'xxx';
    const apiSecret = 'yyy';
    const factor = 1.7;
    const signal = 5;

    //console.log(event["XXBTZUSD"]);
    
    var kraken = new KrakenClient(apiKey,apiSecret);

    //console.log(await kraken.api('Balance'));

    var pair = 'XXBTZUSD';
    var tickerResult = await kraken.api('Ticker', { pair : pair });

    console.log(tickerResult.result);

    var lastTrade = tickerResult.result.XXBTZUSD.c[0];
    var low = tickerResult.result.XXBTZUSD.l[1];
    var high = tickerResult.result.XXBTZUSD.h[1];

    var lowGap = ((lastTrade/low)-1) * 100;
    var highGap = ((low/high)-1) * 100;

    var absoluteHighGap = Math.abs(highGap);
    var spread = Math.abs(lowGap) + absoluteHighGap;

    var threshold = absoluteHighGap * factor;
    
    console.log(spread);
    console.log(threshold);
};