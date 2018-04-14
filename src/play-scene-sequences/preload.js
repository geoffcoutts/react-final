import EnemyIcon from "../assets/falcon.png";
import SkyBackground from "../assets/sky.png";
import GreenLaser from "../assets/bullet38.png";

import WhiteEmitter from "../assets/white_emitter.png";
import RedEmitter from "../assets/red_emitter.png";
import YellowEmitter from "../assets/yellow_emitter.png";

import Explosion from "../assets/explosion.png";
import Pigeon from "../assets/pigeon.png";

export default function() {
	this.load.image("background", SkyBackground);
	this.load.image("laser", GreenLaser);
	this.load.image("white_emitter", WhiteEmitter);
	this.load.image("red_emitter", RedEmitter);
	this.load.image("yellow_emitter", YellowEmitter);

	this.load.spritesheet("pigeon", Pigeon, {
		frameWidth: 120,
		frameHeight: 120,
		endFrame: 3
	});
	this.load.spritesheet("falcon", EnemyIcon, {
		frameWidth: 150,
		frameHeight: 150,
		endFrame: 3
	});
	this.load.spritesheet("explosion", Explosion, {
		frameWidth: 64,
		frameHeight: 64,
		endFrame: 23
	});
}
