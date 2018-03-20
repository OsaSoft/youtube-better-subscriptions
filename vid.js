let videoId = new URL(window.location.href).searchParams.get("v");

let obj = {};
obj[videoId] = Date.now();
getStorage().set(obj);
