import {DEFAULT_SETTINGS, ISettings} from '../settings';

let localSettings: ISettings = {...DEFAULT_SETTINGS};
export function setLocalSettings(newSettings: ISettings): void {
    localSettings = newSettings;
}
export function getSettings() {
    return localSettings;
}
