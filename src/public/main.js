
const button = document.querySelector('.submit-button');
const result = document.querySelector('.result-section');

button.addEventListener('click', event => {
	event.preventDefault();

	const input = document.querySelector('.version-input');
	
	fetch('/new', {
		method: 'POST',
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			// the below may malfunction
			comment: input.value,
		})
	})
	.then(response => {
		if(!response.ok) {
			throw Error(response.statusText);
		}
		return response.json();
	})
	.then(data => {
		while (result.hasChildNodes()) {
			result.removeChild(result.lastChild);
		}
		result.insertAdjacentHTML('afterbegin', `
		<div class="result">
				<p>
					Successfully versioned [Document]!
				</p>
			</div>
		`)
	})
	.catch(console.error)
});