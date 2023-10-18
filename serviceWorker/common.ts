import {prepareMessage} from '../util';

import {getSettings} from './settings';

export function log(content) {
    if (getSettings()['settings.log.enabled']) {
        console.log(prepareMessage(content));
    }
}
