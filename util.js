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

function download(filename, content, applicationType = "text/plain") {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:' + applicationType + ';charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}
