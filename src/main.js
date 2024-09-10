import { VOWELS } from "./sound.js";

export function main() {

	//Activate initial keyboard tab
	document.getElementById("V").style.display = "block";

	let ctx = new AudioContext();

	for (const vow of VOWELS.values()) {
		let b = document.createElement("button");
		b.innerText = vow.ipa;
		b.addEventListener("click", function() {
			vow.play(ctx, 1);
		});
		document.getElementById("sounds").appendChild(b);
	}
}
