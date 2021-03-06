const WebSocket = require("ws");
const SocketServer = WebSocket.Server;
const uuid = require("uuid-v4");
const MAX_PLAYER_COUNT = 3;
const links = [];

const handleDesktopMessage = (ws, message) => {
	let link;
	switch (message.subject) {
		case "connect":
			const link_id = uuid();
			links.push({
				id: link_id,
				code: message.code,
				desktopSocket: ws,
				mobileSockets: [],
				open: true,
				listening: true
			});
			ws.link_id = link_id;
			ws.is_desktop = true;

			setInterval(() => {
				if (ws.readyState !== ws.CLOSED && ws.readyState !== ws.CLOSING) {
					ws.ping();
				}
			}, 30000);
			break;
		case "listen":
			link = links.find(l => l.id === ws.link_id);
			link.listening = true;
			break;
		case "ignore":
			link = links.find(l => l.id === ws.link_id);
			link.listening = false;
			break;
	}
};

const handleMobileMessage = (ws, message) => {
	let link, readyState;
	switch (message.subject) {
		case "connect":
			link = links.find(
				l => l.code === message.code || message.code === "buster"
			);

			if (link) {
				if (link.mobileSockets.length < MAX_PLAYER_COUNT) {
					link.mobileSockets.push(ws);
					ws.player_id = uuid();
					ws.link_id = link.id;
					ws.send(
						JSON.stringify({
							success: true
						})
					);
					link.desktopSocket.send(
						JSON.stringify({
							subject: message.subject,
							player_id: ws.player_id,
							username: message.username
						})
					);
				} else {
					ws.send(
						JSON.stringify({
							error: "Cannot join game, too many users"
						})
					);
					console.log("Link found for mobile, but game is full");
				}
			} else {
				ws.send(
					JSON.stringify({
						error: "Invalid code, please try again"
					})
				);
				console.log("No link found for requesting mobile device");
			}
			setInterval(() => {
				if (ws.readyState !== ws.CLOSED && ws.readyState !== ws.CLOSING) {
					ws.ping();
				}
			}, 30000);
			break;
		case "push":
			link = links.find(l => l.id === ws.link_id);
			if (link) {
				readyState = link.desktopSocket.readyState;
				if (
					readyState !== link.desktopSocket.CLOSED &&
					readyState !== link.desktopSocket.CLOSING &&
					link.listening
				) {
					link.desktopSocket.send(
						JSON.stringify({
							subject: message.subject,
							player_id: ws.player_id,
							velocity: message.velocity
						})
					);
				}
			} else {
				ws.close();
			}
			break;
		case "shoot":
			link = links.find(l => l.id === ws.link_id);
			if (link) {
				readyState = link.desktopSocket.readyState;
				if (
					readyState !== link.desktopSocket.CLOSED &&
					readyState !== link.desktopSocket.CLOSING &&
					link.listening
				) {
					link.desktopSocket.send(
						JSON.stringify({
							subject: message.subject,
							player_id: ws.player_id,
							shooting: message.shooting
						})
					);
				}
			} else {
				ws.close();
			}
			break;
		case "calibrated":
			link = links.find(l => l.id === ws.link_id);
			if (link) {
				readyState = link.desktopSocket.readyState;
				if (
					readyState !== link.desktopSocket.CLOSED &&
					readyState !== link.desktopSocket.CLOSING
				) {
					link.desktopSocket.send(
						JSON.stringify({
							subject: message.subject,
							player_id: ws.player_id
						})
					);
				}
			} else {
				ws.close();
			}
	}
};

module.exports = server => {
	const wss = new SocketServer({ server });

	wss.on("connection", ws => {
		console.log("Client connected");

		ws.on("message", data_string => {
			const message = JSON.parse(data_string);
			switch (message.device) {
				case "desktop":
					handleDesktopMessage(ws, message);
					break;
				case "mobile":
					handleMobileMessage(ws, message);
					break;
			}
		});

		ws.on("close", () => {
			if (ws.is_desktop) {
				const index = links.findIndex(l => l.id === ws.link_id);
				const link = links[index];
				link.open = false;
				for (let ms of link.mobileSockets) {
					ms.close();
				}
				links.splice(index, 1);
				console.log("Desktop disconnected");
			} else {
				const link = links.find(l => l.id === ws.link_id);
				if (link && link.open) {
					index = link.mobileSockets.findIndex(
						ms => ms.player_id === ws.player_id
					);

					link.mobileSockets.splice(index, 1);
					link.desktopSocket.send(
						JSON.stringify({
							subject: "disconnect",
							player_id: ws.player_id
						})
					);
				}
				console.log("Mobile disconnected");
			}
		});
	});
};
