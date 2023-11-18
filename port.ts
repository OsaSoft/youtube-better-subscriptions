import {ISettings} from './settings';

export type TypedPort<IReceive extends object, ISend extends object> = Omit<browser.runtime.Port, 'postMessage' | 'onMessage'> & {
    postMessage: (message: ISend) => void,
    onMessage: Listener<IReceive>,
};

export type IServiceWorkerToContentScriptPayload = {
    type: 'settings',
    settings: ISettings,
} | {
    type: 'watchHistory',
    watchHistory: Record<string, number>,
};

export type IContentScriptToServiceWorkerPayload = {
    type: 'saveVideoOperation',
    operation: 'w' | 'n',
    videoId: string,
} | {
    type: 'getSettings',
} | {
    type: 'getWatchHistory',
} | {
    type: 'openOptionsPage',
};
