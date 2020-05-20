"use strict";

function ready(callback) {
	// in case the document is already rendered
	if (document.readyState != 'loading') {
		callback();
	}
	// modern browsers
	else if (document.addEventListener) {
		document.addEventListener('DOMContentLoaded', callback);
	}
	// IE <= 8
	else {
		document.attachEvent('onreadystatechange', function(){
			if (document.readyState == 'complete') {
				callback();
			}
		});
	}
}

function getPID() {
	var pid = document.location.pathname;
	
	if (pid.endsWith("/index.html")) {
		pid = pid.substr(0, pid.length - "index.html".length);
	}
	if (!pid.endsWith("/")) {
		pid = pid + "/";
	}
	return pid;
}

function getLatest() {
	var pid = getPID();
	var latest = localStorage.getItem(pid + "latest");
	return JSON.parse(latest);
}

function getA(url, next) {
	var collection = [...document.querySelectorAll("a")];
	var result;
	var now = false;
	collection.some(a => {

		if (now) {
			result = a;
			return true;
		}

		if (a.href === url) {
			result = a;
			if (!next) {
				return true;
			} else {
				now = true;
			}
		}

		return false;
	});
	return result;
}

var latestLink;

function setLatestLink(a) {
	if (latestLink === a) {
		return;
	}
	
	if (latestLink) {
		latestLink.classList.remove("latest");		
	}
	latestLink = a;
	if (latestLink) {
		latestLink.classList.add("latest");
	}
}

function updateLatestLink() {
	// Try to obtain the latest item for this page
	var latest = getLatest();

	if (latest) {
		// If there is a latest item for this page, check whether we're at the end of it
		var ct = JSON.parse(localStorage.getItem(latest.persistenceID + "currentTime"));
		var next = ct && ((ct.duration - ct.currentTime) < 59.0); // Within 1 minute of the end
		var a = getA(latest.href, next);
		setLatestLink(a);
		return;
	}

	// We don't have a latest item stored for this page, so see if there's one for the root
	if (!latest) {
		latest = JSON.parse(localStorage.getItem(":root/" + "latest"));
		if (latest) {
			// It could be that this page lists the item directly...
			var a = getA(latest.href);
			if (!a) {
				// ... or it could be that this page lists the container
				var url = new URL(latest.href + "/../../index.html");
				a = getA(url.href);
			}
			setLatestLink(a);
		}
	}
}

function getTargets() {
	return [...document.querySelectorAll("a.audio")];
}

function activeElement() {
	// The activeElement is one of these:
	// 1. The focused A link
	// 2. The latest link
	// 3. The first A link
	var targets = getTargets();

	var currentElement = document.activeElement;
	if (currentElement) {	
		var index = targets.indexOf(currentElement);
		if (index >= 0) {
			return currentElement;
		}
	}

	if (latestLink) {
		return latestLink;
	}

	return targets[0];
}

function focus(direction) {
	
	var targets = getTargets();
	var nextElement = (direction === "last") ? targets[targets.length - 1] : targets[0];

	if (["forward", "back"].includes(direction)) {
		var next = (direction === "forward");
		var currentElement = activeElement();
		if (currentElement) {
			var index = targets.indexOf(currentElement);
			if (index < targets.length) {
				if ((index == 0) && !next) {
					index = targets.length;
				} else if ((index == targets.length - 1) && next) {
					index = -1;
				}
				nextElement = targets[next ? (index + 1) : (index - 1)];
			}
		}
	}

	if (nextElement) {
		moveFocusTo(nextElement);
	}
}

/* Removes articles (English, French, Spanish) */
function simpleTitle(text) {
	return text.replace(/^((the)|(an?)|(l[aeo]s?)|(une?))\s+(.*)$/si, "$6");
}

var selectTimeout;

function moveFocusTo(e) {
	e.focus();
	const attr = "data-selected";
		let p = document.querySelector(`*[${attr}]`);
		if (p) {
			p.removeAttribute(attr);
		}
	e.parentNode.scrollIntoView({
		behavior: "smooth",
		block: "center",
		inline: "start",
	});

	clearTimeout(selectTimeout);
	selectTimeout = setTimeout(() => {
		e.parentNode.setAttribute(attr, "true");
	}, 0.1 * 1000);
}

/*
Focus the first A whose text starts with the specified prefix, otherwise the first A whose text includes the specified text
*/
function focusByPrefix(prefix) {

	function getText(a) {
		return a.textContent.trim().toLowerCase();
	}

	var lower = prefix.toLowerCase();
	var targets = getTargets();
	var nextElement = targets.find(t => {
		let o = getText(t);
		let other = simpleTitle(o);
		return other.startsWith(lower);
	});
	if (!nextElement) {
		let selectors = [".title", ".content"];
		for (let selector of selectors) {
			nextElement = targets.find(t => {
				let subTarget = t.querySelector(selector);
				if (subTarget) {
					return getText(subTarget).includes(lower);
				}
			});
			if (nextElement) {
				break;
			}
		}
	}
	if (nextElement) {
		moveFocusTo(nextElement);
	}
}

function init() {
	updateLatestLink();
	if (latestLink) {
		moveFocusTo(latestLink);
	} else {
		var targets = getTargets();
		moveFocusTo(targets[0]);
	}
	window.setInterval(updateLatestLink, 1 * 1000); // polling local storage every second

	var searchPrefix = "";
	var searchConsumesSpace = false;
	var searchTimeout;
	var searchExecuteTimeout;

	function addToSearch(letter) {
		searchPrefix += letter;
		searchConsumesSpace = true;

		clearTimeout(searchExecuteTimeout);
		searchExecuteTimeout = setTimeout(()=> { focusByPrefix(searchPrefix); }, 0.25 * 1000);

		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(()=> { searchPrefix = ""; searchConsumesSpace = false; }, 0.5 * 1000);
	}

	document.onkeydown = function onkeydown(evt) {
		evt = evt || window.event;
		var handled = false;

		if (evt.key === "ArrowDown") {
			if (!evt.getModifierState("Meta")) {
				focus("forward");
			} else {
				focus("last");
			}
			handled = true;
		} else if (evt.key === "ArrowUp") {
			if (!evt.getModifierState("Meta")) {
				focus("back");
			} else {
				focus("first");
			}
			handled = true;
		} else if (evt.key === "Backspace") {
			window.history.back();
			handled = true;
		} else if (evt.keyCode == 32) { // SPACE
			if (searchConsumesSpace) {
				handled = true;
				addToSearch(" ");
			}
			// Click on the currently active element
			else {
				var e = activeElement();
				if (e) {
					handled = true;
					e.click();
				}
			}
		} else if ((!evt.getModifierState("Meta") && !evt.getModifierState("Control")) && (((65 <= evt.keyCode) && (evt.keyCode < 65+26)) || ((48 <= evt.keyCode) && (evt.keyCode < 48+10)))) {
			var letter = String.fromCharCode(evt.keyCode); // works in this range
			addToSearch(letter);
		}

		if (handled) {
			evt.stopPropagation();
			evt.preventDefault();
		}
	}
}

ready(init);