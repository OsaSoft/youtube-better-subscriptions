export const PREFIX = 'osasoft-better-subscriptions_';

const LOG_HEADER = "[YT-Better-Subs] ";

let printDate = false;

export function logError(error: Error) {
    console.error(prepareMessage("ERROR! "), error.message);
    console.error(error.stack.substring(0, 1000));
}

export function prepareMessage(content = null) {
    let message = LOG_HEADER;
    if (printDate) message += new Date().toTimeString() + ": ";
    if (content != null) message += (typeof content === 'object') ? JSON.stringify(content) : content;

    return message;
}

export function download(filename, content, applicationType = "text/plain") {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:' + applicationType + ';charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

export function isRendered(domObj) {
    if (domObj == document.body) {
        return true;
    }

    var cs = getComputedStyle(domObj);
    if (cs.getPropertyValue("display") != "none" && cs.getPropertyValue("visibility") != "hidden") {
        return isRendered(domObj.parentNode);
    }
    return false;
}

