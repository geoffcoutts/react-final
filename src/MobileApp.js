import React, { Button } from "react";
import ReactDOM from "react-dom";
import NoSleep from "nosleep.js";
import TargetImage from "./assets/target.png";

const initial_alphas = [];
const initial_gammas = [];

const QUICK_CODE = "buster";

const changeInputId = inputId => {
	let i = Number(inputId.charAt(1));
	return `c${i + 1}`;
};

class MobileApp extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			step: 0,
			instruction: "Enter a username to begin.",
			ovec: {
				alpha: 0.0,
				beta: 0.0,
				gamma: 0.0
			},
			alpha_offset: 0.0,
			velocity: {
				x: 0.0,
				y: 0.0
			},
			calibrationTime: 3000,
			useOrientation: () => {},
			angle: window.orientation
		};
		this.calibrationHandler = this.calibrationHandler.bind(this);
		this.handleCodeSubmission = this.handleCodeSubmission.bind(this);
		this.shootHandler = this.shootHandler.bind(this);
		this.ceaseFireHandler = this.ceaseFireHandler.bind(this);
		this.handleUsernameSubmission = this.handleUsernameSubmission.bind(this);
		this.handleInputChange = this.handleInputChange.bind(this);
		this.insomnia = new NoSleep();

		window.addEventListener("orientationchange", () =>
			this.setState({
				angle: window.orientation
			})
		);
	}

	connectToWSS(code) {
		const orientationHandler = event => {
			// SO THE ONLY PREPROCESSING WE DO ON THE OVEC
			// IS TO GIVE ALPHA THE SAME RANGE AS BETA

			const adjusted_alpha = event.alpha - 180.0;
			const normalized_alpha = adjusted_alpha - this.state.alpha_offset;
			let readjusted_alpha;

			if (normalized_alpha > 180) {
				readjusted_alpha = normalized_alpha - 360.0;
			} else if (normalized_alpha < -180.0) {
				readjusted_alpha = normalized_alpha + 360.0;
			} else {
				readjusted_alpha = normalized_alpha;
			}

			this.setState(
				{
					ovec: {
						alpha: readjusted_alpha,
						beta: event.beta,
						gamma: event.gamma
					}
				},
				this.state.useOrientation()
			);
		};

		this.ws = new WebSocket(window.location.origin.replace(/^http/, "ws"));
		this.ws.onopen = () => {
			this.send({
				subject: "connect",
				username: this.state.username,
				code
			});
			this.ws.onmessage = incoming_message => {
				const message = JSON.parse(incoming_message.data);
				if (message.success) {
					this.setState({
						step: 2,
						instruction:
							"Hold your phone up with the back facing your desktop's screen. Press 'Calibrate' when your phone is in a comfy position."
					});
					window.addEventListener(
						"deviceorientation",
						orientationHandler,
						true
					);
				} else {
					this.setState({
						instruction: message.error
					});
				}
			};
			this.ws.onclose = () => {
				window.removeEventListener(
					"deviceorientation",
					orientationHandler,
					true
				);
				this.setState({
					step: 1,
					instruction: "Connection closed. Enter in a new code to play again.",
					ovec: {
						alpha: 0.0,
						beta: 0.0,
						gamma: 0.0
					},
					alpha_offset: 0.0,
					velocity: {
						x: 0.0,
						y: 0.0
					},
					calibrationTime: 3000,
					useOrientation: () => {}
				});
			};
		};
	}

	send(data) {
		const message = {
			device: "mobile"
		};
		for (let key in data) {
			message[key] = data[key];
		}
		this.ws.send(JSON.stringify(message));
	}

	calibrationHandler(event) {
		this.setState(
			{
				step: 3,
				instruction: "Now hold still!",
				useOrientation: () => {
					initial_alphas.push(this.state.ovec.alpha);
					initial_gammas.push(this.state.ovec.gamma);
				}
			},
			() => {
				setTimeout(() => {
					let alpha_sum = 0.0;
					for (let a of initial_alphas) {
						if (a < 0.0) {
							alpha_sum += a + 360.0;
						} else {
							alpha_sum += a;
						}
					}

					const gamma_sum = initial_gammas.reduce((sum, a) => sum + a);

					const alpha_offset = alpha_sum / initial_alphas.length;
					const gamma_offset = gamma_sum / initial_gammas.length;

					const y_zero =
						gamma_offset > 0.0
							? -1.0 * (gamma_offset - 90.0)
							: -1.0 * (gamma_offset + 90.0);

					// TODO make calibration_successful meaningful
					const calibration_successful = true;
					if (calibration_successful) {
						this.send({
							subject: "calibrated"
						});

						this.setState({
							step: 4,
							alpha_offset,
							y_zero,
							useOrientation: () => {
								const a = this.state.ovec.alpha;
								const b = this.state.ovec.beta;
								const g = this.state.ovec.gamma;
								const C = Math.abs(g) / 90.0;

								let beta_component_for_x, alpha_component_for_x, x, y;

								if (g > 0.0) {
									if (b > 0.0) {
										beta_component_for_x = b - 180.0;
									} else {
										beta_component_for_x = b + 180.0;
									}
									if (a > 0.0) {
										alpha_component_for_x = a - 180.0;
									} else {
										alpha_component_for_x = a + 180.0;
									}
									y = -1.0 * (g - 90.0);
								} else {
									beta_component_for_x = b;
									alpha_component_for_x = a;
									y = -1.0 * (g + 90.0);
								}

								x =
									-1.0 *
									((1.0 - C) * beta_component_for_x +
										C * alpha_component_for_x);
								y = y - this.state.y_zero;

								this.setState(
									{
										velocity: {
											x: x / 90.0,
											y: y / 90.0
										}
									},
									() => {
										this.send({
											subject: "push",
											velocity: this.state.velocity
										});
									}
								);
							}
						});
					} else {
						this.setState({
							step: 2,
							instruction: "Your calibration was unsuccessful. Try again.",
							useOrientation: () => {}
						});
					}
				}, this.state.calibrationTime);
			}
		);
	}

	handleCodeSubmission(event) {
		event.preventDefault();
		const code =
			event.target.c0.value +
			event.target.c1.value +
			event.target.c2.value +
			event.target.c3.value +
			event.target.c4.value +
			event.target.c5.value;

		this.connectToWSS(code);
	}

	shootHandler(event) {
		event.preventDefault();
		event.stopPropagation();
		this.send({
			subject: "shoot",
			shooting: true
		});
	}

	ceaseFireHandler(event) {
		event.preventDefault();
		event.stopPropagation();
		this.send({
			subject: "shoot",
			shooting: false
		});
	}

	handleUsernameSubmission(event) {
		event.preventDefault();
		const username = event.target.username.value;
		event.target.username.value = "";
		event.target.button.value = "";

		const validateUsername = username =>
			/^[a-zA-Z0-9]+$/.test(username) &&
			username.length <= 8 &&
			username.length >= 3;

		if (validateUsername(username)) {
			this.insomnia.enable();
			this.setState({
				instruction:
					"Enter the code on your desktop's screen to connect this phone.",
				username,
				step: 1
			});
		} else {
			this.setState({
				instruction:
					"Username must be between 3 and 8 characters, and must contain only letters and numbers."
			});
		}
	}

	handleInputChange(event) {
		if (event.target.value !== "") {
			const form = event.target.form;
			const index = Array.prototype.indexOf.call(form, event.target);
			form.elements[index + 1].focus();
			event.preventDefault();
		}
	}

	renderMain() {
		const MobileWrapper = props => (
			<div className="wrapper">
				<h1 className="wrapper-title">Mission 6ix</h1>
				<p className="instruction">{this.state.instruction}</p>
				<div className="wrapper-child">{props.children}</div>
			</div>
		);

		const WelcomeView = (
			<MobileWrapper>
				<form onSubmit={this.handleUsernameSubmission}>
					<input
						type="text"
						name="username"
						maxlength="8"
						style={{ width: "25%", height: "30px" }}
					/>
					<br />
					<br />
					<input
						className="usernameFormButton"
						type="submit"
						name="button"
						value="Begin"
					/>
				</form>
			</MobileWrapper>
		);

		const getCharInput = i => (
			<input
				style={{ width: "5%", height: "30px" }}
				type="text"
				name={`c${i}`}
				maxlength="1"
				onInput={this.handleInputChange}
			/>
		);

		const getShiftingCharInputs = () => {
			const inputs = [];
			for (let i = 0; i < 5; i++) {
				inputs.push(getCharInput(i));
			}
			return inputs;
		};

		const CodeFormView = (
			<MobileWrapper>
				<form onSubmit={this.handleCodeSubmission}>
					{getShiftingCharInputs()}
					<input
						type="text"
						name="c5"
						maxlength="1"
						style={{ width: "5%", height: "30px" }}
					/>
					<br />
					<br />
					<input className="codeFormButton" type="submit" value="Connect" />
				</form>
			</MobileWrapper>
		);

		const CalibrationButton = this.state.step === 2 && (
			<button className="calibrateButton" onClick={this.calibrationHandler}>
				Calibrate
			</button>
		);

		const CalibrationView = <MobileWrapper>{CalibrationButton}</MobileWrapper>;

		const GameView = (
			<div
				className="gameView"
				onTouchStart={this.shootHandler}
				onTouchEnd={this.ceaseFireHandler}
			>
				<img
					src={TargetImage}
					onTouchStart={this.shootHandler}
					onTouchEnd={this.ceaseFireHandler}
				/>
			</div>
		);

		switch (this.state.step) {
			case 0:
				return WelcomeView;
			case 1:
				return CodeFormView;
			case 2:
				return CalibrationView;
			case 3:
				return CalibrationView;
			case 4:
				return GameView;
		}
	}

	render() {
		if (this.state.angle !== 90) {
			return (
				<div className="wrong-orientation">
					<h1 className="wrong-orientation-main-title">Mission 6ix</h1>
					<p className="wrong-orientation-instructions">
						Hold your phone rotated with the top pointing to the left.
					</p>
				</div>
			);
		}
		return this.renderMain();
	}
}

export default MobileApp;
