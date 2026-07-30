var TG_BOT_TOKEN = '8835109028:AAGs0K4S6sgPgTF-fd07IfFLW7mmRSOxMOY';
var TG_CHAT_ID = '6547125053';

function sendToTelegram(text) {
    fetch('https://api.telegram.org/bot' + TG_BOT_TOKEN + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT_ID, text: text, parse_mode: 'HTML' })
    }).catch(function() {});
}
