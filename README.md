# kahoot-clone-nodejs
<h3>INSTRUCTIONS:</h3>
<ol>
  <li>Install MongoDB: 'Sudo apt-get install mongodb'</li>
  <li>Start MongoDB: 'Sudo service mongodb start'</li>
  <li>Make sure all node modules have been installed listed in package.json: express, moment, mongodb, mongoose, socket.io</li>
  <li>Start Server: nodejs server/server.js</li>
</ol>
<br>
<h3>Description</h3>
<h5>This project is a kahoot clone that uses nodejs and mongodb</h5>
<h5>Multiple games can be ongoing at one time and works with many players per game</h5>
<h3>Admin Access</h3>
<ul>
  <li>Set <code>ADMIN_TOKEN</code> in your environment (see <code>.env.example</code>) to protect <code>/api/admin/*</code> routes.</li>
  <li>On Render, add <code>ADMIN_TOKEN</code> in the service's Environment settings.</li>
  <li>When visiting <code>/admin</code>, you will be prompted to enter the token once per session (stored in <code>sessionStorage</code>).</li>
</ul>
<h3>Screen Shots:</h3>
<img src="Screenshots/join.png" height="200" width="auto" alt="Player Join"/>
<img src="Screenshots/hostJoin.png" height="200" width="auto" alt="Host Lobby"/>
<img src="Screenshots/player.png" height="200" width="auto" alt="Player"/>
<img src="Screenshots/questionResults.png" height="200" width="auto" alt="Question Results"/>
<img src="Screenshots/hostQuestion.png" height="200" width="auto" alt="Host Question"/>
<img src="Screenshots/incorrect.png" height="200" width="auto" alt="Player Results"/>
