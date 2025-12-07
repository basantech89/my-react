import React from "./my-react";

function App(props) {
	return <h1>Hi {props.name}</h1>;
}

const element = <App name="Basant" />;

// console.log("element", element.type(element.props));

const container = document.getElementById("root");
React.render(element, container);
