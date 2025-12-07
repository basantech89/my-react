import React from "./my-react";

const element = (
	<div id="foo">
		<a href="/">bar</a>
		<b />
		<p>Some para 2</p>
	</div>
);

const container = document.getElementById("root");
React.render(element, container);
