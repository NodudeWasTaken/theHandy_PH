// ==UserScript==
// @name         theHandy support for PornHub
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  PH support for the Handy
// @author       Nodude
// @match        https://*.pornhub.com/view_video.php?viewkey=*
// @grant        GM_xmlhttpRequest
// @require      http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js
// @run-at       document-idle
// ==/UserScript==

//Inspired by notSafeForDev

/*
Update 1.2
Added offset support
Update 1.1
Fixed the script only matching english pornhub
*/

class Hander {
    //Literally just taken from handyfeeling's player
    //But in a class
    //Also GM_xmlhttpRequest for that sweet cross-origin bypass
    constructor() {
        //this.URL_BASE = "http://192.168.137.1:3000/";
        this.URL_BASE = "https://www.handyfeeling.com/";
        this.URL_API_ENDPOINT = "api/v1/";
        this.urlAPI = "";

        this.timeSyncMessage = 0;
        this.timeSyncAggregatedOffset = 0;
        this.timeSyncAvrageOffset = 0;
        this.timeSyncInitialOffset = 0;
    }

    onReady(connectionkey, scriptUrl) {
		//URL_BASE can be local ip, but will browsers allow that?
		this.urlAPI = this.URL_BASE + this.URL_API_ENDPOINT + connectionkey;
		this.updateServerTime(); //Strat time sync with teh server

		//Prepare Handy by telling it where to download the script

        var datas = {
            url: scriptUrl,
            timeout: 30000,
        }

        GM_xmlhttpRequest({
            method: "GET",
            url: this.urlAPI + "/syncPrepare?" + new URLSearchParams(datas).toString(),
            onload: function(response) {
                var result = JSON.parse(response.responseText);
                document.getElementById("state").innerHTML += "<li>Machine reply to syncPrepare: " + JSON.stringify(result) + "</li>";
                console.log(result);
                if (result.success == true) {
                    console.log("success");
                    document.getElementById("rdycrl").style.fill = "green";
                }
            }
        });
    }

    setOffset(ms) {
        console.log("offset",ms);

        var datas = {
            offset: ms,
            timeout: 30000,
        }

        GM_xmlhttpRequest({
            method: "GET",
            url: this.urlAPI + "/syncOffset?" + new URLSearchParams(datas).toString(),
            onload: function(response) {
                var result = JSON.parse(response.responseText);
                document.getElementById("state").innerHTML += "<li>Machine reply to syncOffset: " + JSON.stringify(result) + "</li>";
                console.log(result);
            }
        });
    }
    onPlay(videoTime) {
        videoTime = Math.round(videoTime*1000);
		console.log("playing",videoTime);

        var datas = {
            play: true,
            serverTime: this.getServerTime(),
            time: videoTime
        }

        GM_xmlhttpRequest({
            method: "GET",
            url: this.urlAPI + "/syncPlay?" + new URLSearchParams(datas).toString(),
            onload: function(response) {
                var result = JSON.parse(response.responseText);
                document.getElementById("state").innerHTML += "<li>Machine reply to syncPlay: " + JSON.stringify(result) + "</li>";
                console.log(result);
            }
        });
    }
    onPause() {
		console.log("pause");

        var datas = {
            play: false,
        }

        GM_xmlhttpRequest({
            method: "GET",
            url: this.urlAPI + "/syncPlay?" + new URLSearchParams(datas).toString(),
            onload: function(response) {
                var result = JSON.parse(response.responseText);
                document.getElementById("state").innerHTML += "<li>Machine reply to syncPlay: " + JSON.stringify(result) + "</li>";
                console.log(result);
            }
        });
    }

    /*
	    sync time with server
    */

    getServerTime(){
        let serverTimeNow = Date.now() + this.timeSyncAvrageOffset + this.timeSyncInitialOffset;
        return Math.round(serverTimeNow);
    }

    updateServerTime() {
        let sendTime = Date.now();
        let url = this.urlAPI + "/getServerTime";
        // console.log("url:",url);

        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            context: {
                hand: this,
            },
            onload: function(response) {
                var result = JSON.parse(response.responseText);
                var context = response.context || this.context || context;
                var con = context.hand;
                // console.log(result);
                let now = Date.now();
                let receiveTime = now;
                let rtd = receiveTime - sendTime;
                let serverTime = result.serverTime;
                let estimatedServerTimeNow = serverTime + rtd /2;
                let offset = 0;
                if(con.timeSyncMessage == 0){
                    con.timeSyncInitialOffset = estimatedServerTimeNow - now;
                    console.log("timeSyncInitialOffset:",con.timeSyncInitialOffset);
                }else{
                    offset = estimatedServerTimeNow - receiveTime- con.timeSyncInitialOffset;
                    con.timeSyncAggregatedOffset += offset;
                    con.timeSyncAvrageOffset = con.timeSyncAggregatedOffset / con.timeSyncMessage;
                }
                console.log("Time sync reply nr " + con.timeSyncMessage + " (rtd, this offset, average offset):",rtd,offset,con.timeSyncAvrageOffset);
                con.timeSyncMessage++;
                if(con.timeSyncMessage < 30){
                    con.updateServerTime();
                }else{
                    //Time in sync
                    document.getElementById("state").innerHTML += "<li>Server time in sync. Average offset from client time: " + Math.round(con.timeSyncAvrageOffset) + "ms</li>";
                }
            }
        });
    }
}

(function() {
    'use strict';

    var scriptUrl = null;
    var handyKey = null;
    var videoObj = null;
    var hand = new Hander();

    function getElementByXpath(path) {
        return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function shouldHand() {
        console.log(scriptUrl, handyKey);
        return scriptUrl != null && handyKey != null;
    }

    function onplay(e) {
        console.log("play");
        if (shouldHand()) {
            hand.onPlay(videoObj.currentTime);
        }

    }
    function onpause(e) {
        console.log("pause");
        if (shouldHand()) {
            hand.onPause();
        }
    }

    async function init() {
        //User config
        const selecting = document.createElement("div");
        selecting.style.padding = "20px";

        selecting.innerHTML += '<svg height="100" width="100" style="position:absolute; right:0px;"><circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" id="rdycrl" fill="red" /></svg>';
        selecting.appendChild(document.createElement("br"));

        const finputText = document.createElement("input");
        finputText.type = "file";
        finputText.placeholder = "Select a file";
        selecting.appendChild(finputText);

        selecting.appendChild(document.createElement("br"));

        const inputText = document.createElement("input");
        inputText.type = "text";
        inputText.placeholder = "Enter connection key";
        inputText.disabled = true;
        selecting.appendChild(inputText);

        selecting.appendChild(document.createElement("br"));

        const inputOffset = document.createElement("label");
        inputOffset.innerHTML += 'Offset:<input type="number" name="Offset" value="0"><span> ms</span></label>';
        selecting.appendChild(inputOffset);
        const inputOffsetI = inputOffset.getElementsByTagName("input")[0];

        var stats = document.createElement("a");
        stats.id="state";
        selecting.appendChild(stats);

        document.getElementsByClassName("video-actions-container")[0].prepend(selecting);


        //Video listening
        while (videoObj==null) {
            videoObj = getElementByXpath("//div[contains(@class,'_videoWrapper')]/video");
            await sleep(100);
        }

        inputOffsetI.addEventListener("keyup", function(event) {
            if (event.keyCode === 13) {
                event.preventDefault();
                hand.setOffset(inputOffsetI.value);
            }
        });
        inputText.addEventListener("keyup", function(event) {
            // Number 13 is the "Enter" key on the keyboard
            if (event.keyCode === 13) {
                // Cancel the default action, if needed
                event.preventDefault();
                handyKey = inputText.value;
                hand.onReady(handyKey, scriptUrl);
            }
        });
        finputText.addEventListener("change", function(event) {
            var files = event.target.files; // FileList object

            var filename = window.location.href.substr(window.location.href.indexOf("viewkey=")+8);

            var formData = new FormData();
            formData.set("syncFile", new File(files, filename + ".funscript")); //TODO: csv upload?

            GM_xmlhttpRequest({
                method: "POST",
                url: "https://www.handyfeeling.com/api/sync/upload",
                data:formData,
                context: {
                    scriptUrl: scriptUrl,
                },
                onload: function(response) {
                    var context = response.context || this.context || context;
                    var jsonResponse = response.responseText;
                    if (response.status == 200) {
                        document.getElementById("state").innerHTML += "<li>Script Uploaded!</li>";
                        scriptUrl = JSON.parse(jsonResponse).url;
                        inputText.disabled = false;
                    } else {
                        document.getElementById("state").innerHTML += "<li>Error " + response.status + " occurred when trying to upload your file.</li>";
                    }
                    console.log(jsonResponse);
                }
            });

            event.preventDefault();
        }, false);

        videoObj.addEventListener("play", onplay);
        videoObj.addEventListener("pause", onpause);

        console.log("Done!");
    }

    init();

})();
