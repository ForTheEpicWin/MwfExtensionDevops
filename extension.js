// ==UserScript==
// @name         cached images test
// @namespace    https://makeworkflow.de
// @version      1.0.0
// @description  Inserts an image from a specified Workitemfield into a the specific workitem on a the kanban board page from production.flow
// @match        https://dev.azure.com/MWF-Development-Boards/Saminco-BLB/_boards/board/t/Saminco-BLB%20Team/Orders
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.7.0/jquery.min.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @copyright    MAKE WORK FLOW GmbH
// @author       Feiko Bronsveld
// @sandbox      JavaScript

// ==/UserScript==

(function() {
    'use strict';

    // ExtensionCache DB setup
    const dbName = "ExtensionCacheDB";
    const storeName = "images";
    let db;

    // OPEN DB CONNECTION
    const openDB = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, 1);

            request.onupgradeneeded = function(event) {
                db = event.target.result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: "url" });
                }
            };

            request.onsuccess = function(event) {
                db = event.target.result;
                resolve(db);
            };

            request.onerror = function(event) {
                console.error("IndexedDB error:", event.target.errorCode);
                reject(event.target.errorCode);
            };
        });
    };

    // CACHE IMAGE
    const cacheImage = (url, callback) => {
        fetch(url)
            .then(response => {
            if (!response.ok) {
                throw new Error(`Network response was not ok, status: ${response.status}`);
            }

            // Check if the content type of the response is suitable for blob conversion
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("image")) {
                throw new Error(`Response is not an image, content type: ${contentType}`);
            }

            return response.blob();
        })
            .then(blob => {
            // Blob conversion should be successful here
            const transaction = db.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            var putRequest = store.put({ url: url, data: blob });

            putRequest.onsuccess = function() {
                console.log("Image cached successfully");
                if (typeof callback === "function") {
                    const URLObject = window.URL || window.webkitURL;
                    const imageURL = URLObject.createObjectURL(blob);
                    callback(imageURL);
                }
            };

            putRequest.onerror = function(event) {
                console.log("Error caching image:", event.target.error);
            };
        })
            .catch(error => console.error('Error during fetching and caching:', error));
    };


    const retrieveImage = (url, callback) => {
        const transaction = db.transaction([storeName]);
        const store = transaction.objectStore(storeName);
        const request = store.get(url);

        request.onsuccess = function(event) {
            if (event.target.result) {
                const URLObject = window.URL || window.webkitURL;
                const imageURL = URLObject.createObjectURL(event.target.result.data);
                callback(imageURL);
            } else {
                cacheImage(url, callback);
            }
        };

        request.onerror = function(event) {
            console.error('Error in retrieving from cache:', event);
        };
    };

    // Initialize IndexedDB
    openDB();

    // TEST IF URL IS VALID IMAGE
    function testImageUrl(url) {
        return new Promise(function(resolve, reject) {
            var image = new Image();

            image.onload = function() {
                resolve(true);
            };

            image.onerror = function() {
                resolve(false);
            };

            image.src = url;
        });
    }

    function updateImageElement(imageElement, src, jNode) {
       if (!imageElement.length) {
           let img = document.createElement("img");
           img.src = src;
           img.width = 75;
           img.height = 75;
           img.style.marginRight = "auto";
           img.className = "workItemPictures";
           jNode.parent().parent().prev().children(':first').prepend(img);
       } else {
           imageElement.attr('src', src);
       }
       jNode.parent().hide();
    }

    // ON IMAGE FIELD FOUND
    let imageFieldLabel = 'div.label.text-ellipsis:contains("IMAGE URL")';
    let imageFieldParent = 'div.editable-field.value.not-editing';
    let imageFieldValueElement = 'div.text-ellipsis';

    function onImageFieldFound(jNode) {
        var imageURL = jNode.next(imageFieldParent).find(imageFieldValueElement).text();
        var image = jNode.parent().parent().find("img");

        if (!imageURL || !testImageUrl(imageURL)) {
            console.log("Invalid or empty IMAGE URL, skipping fetch and cache.");
            image.remove();
            return;
        }

        retrieveImage(imageURL, function(cachedSrc) {
            if (cachedSrc) {
                updateImageElement(image, cachedSrc, jNode);
            } else {
                // Only fetch the image if not found in cache
                testImageUrl(imageURL).then(function(isValidImage) {
                    if (isValidImage) {
                        cacheImage(imageURL, function(blob) {
                            const URLObject = window.URL || window.webkitURL;
                            const imageURL = URLObject.createObjectURL(blob);
                            updateImageElement(image, imageURL, jNode);
                        });
                    } else {
                        image.remove();
                    }
                });
            }
        });
    }

    waitForKeyElements(imageFieldLabel, onImageFieldFound);
})();
