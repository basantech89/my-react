import React from "./my-react";

function Counter() {
	const [state, setState] = React.useState(1);
	const [state2, setState2] = React.useState(10);

	React.useEffect(() => {
		console.log("Effect ran");
	}, [state]);

	return (
		<h1 onClick={() => setState((c) => c + 1)} style="user-select: none">
			Count: {state} {state2}
		</h1>
	);
}

const element = <Counter />;

// console.log("element", element.type(element.props));

const container = document.getElementById("root");
React.render(element, container);
