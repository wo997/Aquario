const fs = require('fs');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http); //bilbio do socketa - nmp install --save socket.io
const url = require('url');

app.get('/', function(req, res){ //ładuje index.html zamiast domyślnie
  res.sendFile(__dirname + '/htdocs/index.html');
});

app.use('/htdocs', express.static(__dirname+'/htdocs'));

var HOWMANYSLOTS = 10;

var SLOTS = [];
for (i=0;i<HOWMANYSLOTS;i++) SLOTS.push(false);

var slotID = [];
for (i=0;i<HOWMANYSLOTS;i++) slotID.push(0);

var FISH = []; // px,py,size,vel,dir,color,targetDir,boost,nick,hp,stamina
for (i=0;i<HOWMANYSLOTS;i++) FISH.push([0,0,0,0,0,0,0,0,"",0,0]);

var SHARK = []; // px,py,size,vel,dir,targetDir
SHARK.push([2000,500,5,3,0,1]);
SHARK.push([4000,500,5,3,0,1]);
SHARK.push([6000,500,5,3,0,1]);
SHARK.push([8000,500,5,3,0,1]);
SHARK.push([1500,300,5,3,0,1]);

var BOTTOM = [], BOTTOMSIZE = 50, BOUNDRIGHT = 15000, BOTTOMKEY;

var time = 0;

function randomizeBottom()
{
	BOTTOMKEY = Math.random();
	
	BOTTOM = [];
	MAPWIDTH = 250;
	MAPHEIGHT = 100;
	
	BOTTOM = [Math.random()-0.5];
	
	var vel = 0;
	for (x=1;x<BOUNDRIGHT/BOTTOMSIZE;x++)
	{
		vel = 0.99*vel + pseudoRandom(x);
		BOTTOM.push((BOTTOM[x-1] + vel) * 0.5);
	}
	
	for (x=0;x<BOTTOM.length;x++)
	{
		BOTTOM[x] = (BOTTOM[x]*20+350)*(Math.atan((x*BOTTOMSIZE-1500)/200)-Math.atan((x*BOTTOMSIZE+2500-BOUNDRIGHT)/200))-80;
	}
}

function pseudoRandom(i)
{
	return Math.abs(23*Math.sin(BOTTOMKEY*i+273*i)+23*Math.tan(BOTTOMKEY*i*(0.2-3*i)))%1-0.5;
}

//var chatBuffer = []; //bufor czatu
io.on('connection',function(s){
	s.on('disconnect',function(){
		console.log("a user disconnected");
		var evt = {user: this.username.toString()};
		//io.emit('bye',evt);
		//chatBuffer.push({m: 'bye', e: evt});
		
		disconnectPlayer(s.playerid);
	});
	
	/*s.on('msg',function(msg){
		var evt = {user: this.username.toString(), msg: msg};
		io.emit('msg',evt);
		chatBuffer.push({m: 'msg', e: evt});
	});
	s.on('userset',function(set){
		var evt = {old: this.username.toString(), snew: set};
		io.emit('userset',evt);
		this.username = set;
		chatBuffer.push({m: 'userset', e: evt});
	});*/
	s.on('position',function(targetDir,boost){
		if (typeof targetDir != "number" || typeof boost != "boolean") return;
		if (FISH[s.playerid])
		{
			FISH[s.playerid][6] = targetDir;
			FISH[s.playerid][7] = boost;
		}
	});
	s.on('tasty',function(get){
		if (typeof get != "number") return;
		gain(s.playerid,get);
	});
	//s.emit('buffer',chatBuffer); //wysyla iwenta
	s.username = "A socket.io chat user";
	s.playerid = -1;
	console.log("a user connected");
	var evt = {user: s.username.toString()};
	//io.emit('hi',evt);
	//chatBuffer.push({m: 'hi', e: evt});
	
	s.on('accessToken',function(evt){
		var gotit = false;
		for (i=0;i<SLOTS.length;i++)
		{
			if (!SLOTS[i])
			{
				gotit = true;
				console.log(s.id+" joined");
				slotID[i] = s.id;
				s.playerid = i;
				SLOTS[i] = true;				
				var name = evt.nickname;
				if (name.length>15 || name.length<1) name = "Guest"+(i+1);
				
				var sx = 3000+(BOUNDRIGHT-6000)*Math.random();
				var sy = 100+600*Math.random();
				
				if (!isSafe(sx,sy))
				{
					for (x=3000;x<BOUNDRIGHT-3000;x+=500)
					{
						for (y=100;y<400;y+=300)
						{
							if (isSafe(x,y))
							{
								sx = x;
								sy = y;
								x=100000;
								break;
							}
						}
					}
				}
				FISH[i] = [sx,sy,1,0,0,evt.color,0,0,name,100,100];
				s.emit('playerAdded',BOTTOMKEY,BOUNDRIGHT,i);
				i=100000000;
			}
		};
		if (!gotit)
		{
			s.emit('noSlots');
			s.disconnect();
		}
		
		//io.emit('userData',{id: s.id, color: evt.color, nickname: evt.nickname});
		//var sessionid = s.sessionid; //
	});
});

function gain(i,get)
{
	if (FISH[i][9]<100)
	{
		FISH[i][9]+=100*get;
		if (FISH[i][9]>100) FISH[i][9]=100;
	}
	else FISH[i][2] += get;
}

function lose(i,get)
{
	if (FISH[i][2]>1)
	{
		FISH[i][2] -= get/2;
		FISH[i][9] -= 50*get;
		if (FISH[i][2]<1) FISH[i][2]=1;
	}
	else
	{
		FISH[i][2] = 1;
		FISH[i][9] -= 100*get;
	}
}

function isSafe(x,y)
{
	var safe = true;
	for (a=0;a<FISH.length;a++)
	{
		var dx = FISH[a][0]-x;
		var dy = FISH[a][1]-y;
		if (dx*dx+dy*dy<500000)
		{
			safe = false;
			break;
		}
	}
	
	for (a=0;a<SHARK.length;a++)
	{
		var dx = SHARK[a][0]-x;
		var dy = SHARK[a][1]-y;
		if (dx*dx+dy*dy<100000)
		{
			safe = false;
			break;
		}
	}
	return safe;
}

function disconnectPlayer(i)
{
	var con = io.sockets.connected[slotID[i]];
	if (con)
	{
		con.emit("died");
		con.disconnect();
	}
	FISH[i] = [0,0,0,0,0,0,0,0,"",0,0];
	slotID[i] = 0;
	SLOTS[i] = false;
}

function CREATELEVEL()
{
	randomizeBottom();
}

var PLAYERS = {data:null};
var SENDSHARKS = {data:null};

function getSize(s)
{
	return 0.7*Math.pow(s,0.35);
}

function HANDLEGAME()
{
	time++;
	
	for (i=0;i<FISH.length;i++)
	{
		//console.log(i+" "+FISH[i][0]);
		if (FISH[i][0]==0) continue;
		
		var fish = FISH[i];
		var dir = fish[4];
		FX = fish[0];
		FY = fish[1];
		SIN = Math.sin(dir);
		COS = Math.cos(dir);
		SIZE = getSize(fish[2]);
		VEL = fish[3];
		FISH[i][0] += VEL*COS;
		FISH[i][1] += VEL*SIN;
		var mouthX = FX + COS*SIZE*18;
		var mouthY = FY + SIN*SIZE*18;
		
		FISH[i][2] -= 0.00001*(SIZE-0.7)*(200-FISH[i][9]);
		
		/*for (a=0;a<PLANKTON.length;a++)
		{
			if (Math.pow(PLANKTON[a][0]-FX,2)+Math.pow(PLANKTON[a][1]-FY,2)<SIZE*SIZE*100+50)
			{
				PLANKTON.splice(a,1);
				FISH[i][2] += 0.1;
			}
		}*/
		
		for (a=0;a<FISH.length;a++)
		{
			if (i==a) continue;
			var dx = FISH[a][0]-mouthX;
			var dy = FISH[a][1]-mouthY;
			var s2 = getSize(FISH[a][2]);
			
			if (dx*dx+dy*dy < squared(SIZE*8+s2*18))
			{
				var ratio = 0.03*Math.sqrt(SIZE/s2);
				gain(i,ratio);
				lose(a,ratio);
				if (FISH[a][9] <= 0) gain(i,FISH[a][2]);
				FISH[i][3] *= 0.95;
			}
		}
		
		if (FY > SIZE * 5.9)
		{
			var turn = (mod(FISH[i][6]-dir,2*Math.PI)-Math.PI);
			if (turn>1) turn = 1;
			if (turn<-1) turn = -1;
			
			FISH[i][4] += turn/(10+5*SIZE);
			
			if (FISH[i][7] && FISH[i][10]>0.5)
			{
				FISH[i][3] += 0.2;
				FISH[i][10] -= 0.5;
			}
		}
		FISH[i][10] += 0.07;
		if (FISH[i][10]>100) FISH[i][10] = 100;
		
		var how = mod(FX/BOTTOMSIZE,1);
		var le = BOTTOM[Math.floor(FX/BOTTOMSIZE)];
		var ri = BOTTOM[Math.ceil(FX/BOTTOMSIZE)];
		var bottom = le*(1-how) + ri*how - SIZE * 12;
		if (FY > bottom)
		{
			var much = (FY - bottom)*0.3;
			FISH[i][3] *= 1-0.01*much;
			FISH[i][0] += much * (ri-le)/BOTTOMSIZE;
			FISH[i][1] -= much;
			
			much = SIZE * 6 - FY;
			if (much>0)
			{
				if (much>5) much = 5;
				FISH[i][4] += SIN * (COS<0?1:-1) * 0.02 * much;
				FISH[i][3] *= 0.97;
				FISH[i][9] -= 0.5;
			}
		}
		else if (FY < SIZE * 6)
		{
			much = SIZE * 6 - FY;
			if (much>0)
			{
				if (much>5) much = 5;
				FISH[i][4] += much * (COS>0?0.02:-0.02)/(Math.abs(VEL)+0.1);
				FISH[i][3] += much * SIN * 0.025;
				FISH[i][1] += 0.1;
			}
		}
		else FISH[i][3] = FISH[i][3]*0.9 + 0.25;
		
		if (FISH[i][9]<=0 || FISH[i][2]<1)
		{
			//FISH[i][3] = 0;
			//FISH[i][9] = 0;
			disconnectPlayer(i);
		}
		else
		{
			FISH[i][9] += 0.03;
			if (FISH[i][9]>100) FISH[i][9] = 100;
		}
	}
	
	var len = 270 + 80 * Math.sin(time*0.01);
	var shift = 150 + 80 * Math.sin(time*0.003427);
	
	for (i=0;i<SHARK.length;i++)
	{
		var fish = SHARK[i];
		var vel = fish[3];
		var dir = fish[4];
		FX = fish[0];
		FY = fish[1];
		SIN = Math.sin(dir);
		COS = Math.cos(dir);
		SIZE = fish[2];
		VEL = fish[3];
		SHARK[i][0] = FX + vel*COS;
		SHARK[i][1] = FY + vel*SIN;
		var mouthX = FX + COS*SIZE*18;
		var mouthY = FY + SIN*SIZE*18;
		
		var followClosest = 10000000;
		
		for (a=0;a<FISH.length;a++)
		{
			if (FISH[a][0]==0) continue;
			
			var dx = FISH[a][0]-mouthX;
			var dy = FISH[a][1]-mouthY;
			var dist = dx*dx+dy*dy;
			var s2 = getSize(FISH[a][2]);
			
			if (FY>30 && dist<60000 && Math.random()<0.1)
			{
				if (dist < followClosest)
				{
					followClosest = dist
					SHARK[i][5] = Math.atan2(dy,dx);
					
					var dx = FISH[a][0]-FX;
					var dy = FISH[a][1]-FY;
					if (dx*dx+dy*dy < SIZE*SIZE*550)
					{
						SHARK[i][3] *= 0.8;
					}
				}
			}
			
			if (dist<Math.pow(SIZE*2+s2,2)*25)
			{
				FISH[a][9] -= 3/(2+s2);
			}
		}
		
		if (FY > SIZE * 5.9)
		{
			var turn = (mod(SHARK[i][5]+Math.PI-dir,2*Math.PI)-Math.PI);
			if (turn>1) turn = 1;
			if (turn<-1) turn = -1;
			
			SHARK[i][4] += turn/(10+10*SIZE);
		}
		
		var how = mod(FX/BOTTOMSIZE,1);
		var le = BOTTOM[Math.floor(FX/BOTTOMSIZE)];
		var ri = BOTTOM[Math.ceil(FX/BOTTOMSIZE)];
		var bottom = le*(1-how) + ri*how - SIZE * 6;
		if (FY > bottom)
		{
			var much = (FY - bottom)*0.3;
			SHARK[i][3] *= 1-0.01*much;
			SHARK[i][0] += much * (ri-le)/BOTTOMSIZE;
			SHARK[i][1] -= much;
			
			much = SIZE * 3 - FY;
			if (much>0)
			{
				if (much>5) much = 5;
				SHARK[i][4] += SIN * (COS<0?1:-1) * 0.02 * much;
				SHARK[i][3] *= 0.97;
				if (FX<BOUNDRIGHT/2) SHARK[i][0] += 500;
				else SHARK[i][0] -= 500;
			}
		}
		else if (FY < SIZE * 3)
		{
			var much = SIZE * 3 - FY;
			if (much>0)
			{
				if (much>5) much = 5;
				SHARK[i][4] += much * (COS>0?0.01:-0.01)/(Math.abs(VEL)+0.1);
				SHARK[i][3] += much * SIN * 0.025;
			}
		}
		else SHARK[i][3] = SHARK[i][3]*0.9 + 0.25 + 0.1 * Math.sin(i+time*0.001);
		
		SIN = Math.sin(SHARK[i][5]);
		COS = Math.cos(SHARK[i][5]);
		
		var s1 = sensor(FX+COS*len+SIN*shift,FY+SIN*len-COS*shift);
		var s2 = sensor(FX+COS*len-SIN*shift,FY+SIN*len+COS*shift);
		
		if (s1) SHARK[i][5] += 0.2;
		if (s2) SHARK[i][5] -= 0.2;
		if (s1 && s2)
		{
			SHARK[i][3] *= 0.85;
			SHARK[i][5] += Math.PI;
		}
		if (!s1 && !s2) SHARK[i][5] += Math.random()*0.05-0.025;
		if (Math.abs(Math.sin(SHARK[i][5]))<0.1) SHARK[i][5]+=(2*Math.round(Math.random())-1)*0.3;
	}
	
	PLAYERS.data = FISH;
	SENDSHARKS.data = SHARK;
	
	var d = new Date();
	var delay = 1000*d.getSeconds()+d.getMilliseconds();
	
	if (once<1) once++;
	else
	{
		once = 0;
		io.emit('updatePlayers',PLAYERS,SENDSHARKS,delay);
	}
	setTimeout(HANDLEGAME,1000/60);
	// FPS SET TO 30 WORKS AS WELL JUST MULTIPLY DIRECTION AND VELOCITY BY A CONST FACTOR EASY BRO
}

var once = 0; // skip 1/2

function squared(n)
{
	return n*n;
}

function sensor(x,y)
{
	return (y<0 || y>BOTTOM[Math.round(x/BOTTOMSIZE)]);
}

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function mod(a,b)
{
	return (a%b+b)%b;
}

CREATELEVEL();
HANDLEGAME();

var port = process.env.PORT || 8080;

http.listen(port, function(){ //nasluchuje
  console.log('listening on *:80');
});


