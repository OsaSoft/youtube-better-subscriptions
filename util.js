const LOG_HEADER = "[YT-Better-Subs] ";

// Log levels: 1=ERROR, 2=WARN, 3=INFO, 4=DEBUG
const LOG_LEVEL = { ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4 };

function getLogLevel() {
    return settings["settings.log.level"] ?? LOG_LEVEL.ERROR;
}

function log(content) {
    if (getLogLevel() >= LOG_LEVEL.INFO) {
        console.log(prepareMessage(content));
    }
}

function logDebug(content) {
    if (getLogLevel() >= LOG_LEVEL.DEBUG) {
        console.log(prepareMessage(content));
    }
}

function logWarn(content) {
    if (getLogLevel() >= LOG_LEVEL.WARN) {
        console.warn(prepareMessage(content));
    }
}

function logError(error) {
    // Always print errors regardless of log level
    console.error(prepareMessage("ERROR! "), error.message);
    console.error(error.stack.substring(0, 1000));
}

function prepareMessage(content = null) {
    let message = LOG_HEADER;
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
function isRendered(domObj) {
    if (domObj == document.body) {
        return true;
    }

    var cs = getComputedStyle(domObj);
    if (cs.getPropertyValue("display") != "none" && cs.getPropertyValue("visibility") != "hidden") {
        return isRendered(domObj.parentNode);
    }
    return false;
}