import { VOWELS } from "./sound.js";

export function main() {
	let ctx = new AudioContext();

	for (const vow of VOWELS.values()) {
		let b = document.createElement("button");
		b.innerText = vow.ipa;
		b.addEventListener("click", function() {
			vow.play(ctx, 1);
		});
		document.body.appendChild(b);
	}
}
