export const PREFIX = 'osasoft-better-subscriptions_';

const LOG_HEADER = '[YT-Better-Subs] ';

const printDate = false;

export function logError(error: Error) {
    console.error(prepareMessage('ERROR! '), error.message);
    console.error(error.stack.slice(0, 1000));
}

export function prepareMessage(content = null) {
    let message = LOG_HEADER;
    if (printDate) {
        message += new Date().toTimeString() + ': ';
    }
    if (content) {
        message += (typeof content === 'object') ? JSON.stringify(content) : content;
    }

    return message;
}

export function download(filename: string, content: string, applicationType = 'text/plain') {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:' + applicationType + ';charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.append(element);

    element.click();

    element.remove();
}

export function isRendered(domObj) {
    if (domObj === document.body) {
        return true;
    }

    const cs = getComputedStyle(domObj);
    if (cs.getPropertyValue('display') !== 'none' && cs.getPropertyValue('visibility') !== 'hidden') {
        return isRendered(domObj.parentNode);
    }
    return false;
}

