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
    console.error(prepareMessage("ERROR! "), error?.message ?? error);
    if (error?.stack) console.error(error.stack.substring(0, 1000));
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

// Length of a string in UTF-8 bytes (TextEncoder isn't available everywhere this runs)
function utf8ByteLength(text) {
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
        let code = text.charCodeAt(i);
        if (code < 0x80) {
            bytes += 1;
        } else if (code < 0x800) {
            bytes += 2;
        } else if (code >= 0xD800 && code <= 0xDBFF && (text.charCodeAt(i + 1) & 0xFC00) === 0xDC00) {
            // a surrogate pair: one 4-byte character
            bytes += 4;
            i++;
        } else {
            bytes += 3;
        }
    }
    return bytes;
}

// The bytes a storage.sync item counts against the quota, measured as Chrome does: the key's length
// plus the length of the value as JSON, both in UTF-8
function syncItemBytes(key, value) {
    return utf8ByteLength(key) + utf8ByteLength(JSON.stringify(value));
}
