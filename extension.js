// ==UserScript==
// @name         Image Caching with IndexedDB
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Cache images using IndexedDB in Tampermonkey
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var db;

    // Initialize and open IndexedDB
    function initDB() {
        var request = indexedDB.open("largeImageCacheDB", 1);

        request.onupgradeneeded = function(event) {
            db = event.target.result;
            db.createObjectStore("images", { keyPath: "url" });
        };

        request.onerror = function(event) {
            console.error("Database error: ", event.target.errorCode);
        };

        request.onsuccess = function(event) {
            db = event.target.result;
        };
    }

    // Function to check and retrieve image from cache
    function getImage(url, callback) {
        var transaction = db.transaction(["images"], "readonly");
        var store = transaction.objectStore("images");
        var request = store.get(url);

        request.onsuccess = function(event) {
            if (event.target.result) {
                console.log("Loading from cache:", url);
                callback(URL.createObjectURL(event.target.result.blob));
            } else {
                console.log("Fetching and caching:", url);
                fetchAndCacheImage(url, callback);
            }
        };

        request.onerror = function() {
            console.error("Failed to retrieve from IndexedDB");
        };
    }

    // Function to fetch and cache the image
    function fetchAndCacheImage(url, callback) {
        fetch(url)
            .then(response => response.blob())
            .then(blob => {
                var transaction = db.transaction(["images"], "readwrite");
                var store = transaction.objectStore("images");
                store.add({ url: url, blob: blob });

                transaction.oncomplete = function() {
                    callback(URL.createObjectURL(blob));
                };

                transaction.onerror = function() {
                    console.error("Failed to cache image in IndexedDB");
                };
            })
            .catch(error => {
                console.error("Failed to fetch image:", error);
            });
    }

    // Initialize the database
    initDB();

    // Example usage: Replace 'http://example.com/large-image.jpg' with the actual image URL
    // and 'imageElementId' with the ID of an img element on the page.
    getImage("http://example.com/large-image.jpg", function(src) {
        document.getElementById("imageElementId").src = src;
    });

})();
