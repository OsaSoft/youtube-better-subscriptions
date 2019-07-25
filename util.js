const LOG_HEADER = "[YT-Better-Subs] ";

let enableLogging = true;
let printDate = false;

function log(content) {
    if (enableLogging) {
        console.log(prepareMessage(content));
    }
}

function logError(error) {
    console.error(prepareMessage("ERROR! "), error.message);
    console.error(error.stack.substring(0, 1000));
}

function prepareMessage(content = null) {
    let message = LOG_HEADER;
    if (printDate) message += new Date().toTimeString() + ": ";
    if (content != null) message += (typeof content === 'object') ? JSON.stringify(content) : content;

    return message;
}
