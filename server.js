const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
/*const numCPUs = require('os').cpus().length;
const cluster = require('cluster');


if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
  
  return;
}


console.log(`Worker ${process.pid} is running`);

console.log(numCPUs);
*/
app.get('/', function(req, res){
  res.sendFile(__dirname + '/htdocs/index.html');
});

app.use('/htdocs', express.static(__dirname+'/htdocs'));

const HOWMANYSLOTS = 10;

var SLOTS = [];
for (i=0;i<HOWMANYSLOTS;i++) SLOTS.push(false);

var slotID = [];
for (i=0;i<HOWMANYSLOTS;i++) slotID.push(0);

var FISH = []; // px,py,size,vel,dir,color,targetDir,boost,nick,hp,stamina
for (i=0;i<HOWMANYSLOTS;i++) FISH.push([0,0,0,0,0,0,0,0,"",0,0,0]);

var SHARK = []; // px,py,size,vel,dir,targetDir
SHARK.push([2000,500,5,3,0,1]);
SHARK.push([4000,500,5,3,0,1]);
SHARK.push([6000,500,5,3,0,1]);
SHARK.push([8000,500,5,3,0,1]);
SHARK.push([1500,300,5,3,0,1]);

var boatX = 3000;
var boatVX = 0;
var boatTargetX = 2800;
var boatWaitTarget = 0;
var boatStop = false;
var rodUp = 0;
var hookX = 0;
var hookY = 0;
var hookVX = 0;
var hookVY = 0;
var veinLen = 0;
var huntId = -1;

var BOTTOM = [];
const BOTTOMSIZE = 50;
const BOUNDRIGHT = 13000;
var BOTTOMKEY;

var TIME = 0;

function randomizeBottom()
{
	BOTTOMKEY = Math.random();
	
	BOTTOM = [];
	MAPWIDTH = 250;
	MAPHEIGHT = 100;
	
	BOTTOM = [Math.random()-0.5];
	
	var vel = 0;
	for (x=1;x<BOUNDRIGHT/BOTTOMSIZE+2;x++)
	{
		vel = 0.99*vel + pseudoRandom(x);
		BOTTOM.push((BOTTOM[x-1] + vel) * 0.5);
	}
	
	for (x=0;x<BOTTOM.length;x++)
	{
		BOTTOM[x] = (BOTTOM[x]*20+350)*(Math.atan((x*BOTTOMSIZE-1500)/200)-Math.atan((x*BOTTOMSIZE+1500-BOUNDRIGHT)/200))-80;
	}
}

function pseudoRandom(i)
{
	return Math.abs(23*Math.sin(BOTTOMKEY*i+273*i)+23*Math.tan(BOTTOMKEY*i*(0.2-3*i)))%1-0.5;
}

io.on('connection',function(s){
	s.on('disconnect',function(){
		console.log("a user disconnected");
		var evt = {user: this.username.toString()};
		
		disconnectPlayer(s.playerid);
	});
	s.on('position',function(targetDir,boost){
		if (typeof targetDir != "number" || typeof boost != "boolean") return;
		if (FISH[s.playerid])
		{
			FISH[s.playerid][6] = targetDir;
			FISH[s.playerid][7] = boost;
		}
	});
	/*s.on('tasty',function(get){
		if (typeof get != "number") return;
		gain(s.playerid,get);
	});*/
	s.on('tasty',function(){
		gain(s.playerid,0.1);
	});
	s.on('yummy',function(){
		gain(s.playerid,0.1);
		FISH[s.playerid][10] += 25;
		if (FISH[s.playerid][10] > 100) FISH[s.playerid][10] = 100;
	});
	s.on('chat',function(mess){
		if (mess.length<70)
		{
			if (mess.length>35)
			{
				var split = Math.floor(mess.length/2);
				if (mess[split]!=" ")
				{
					if (mess[split-1]==" ") split--;
					else if (mess[split+1]==" ") split++;
					else
					{
						if (mess[split-2]==" ") split-=2;
						else if (mess[split+2]==" ") split+=2;
						
					}
				}
				io.emit("chat",FISH[s.playerid][8]+": "+mess.substr(0,split));
				io.emit("chat",FISH[s.playerid][8]+": "+mess.substr(split));
			}
			else io.emit("chat",FISH[s.playerid][8]+": "+mess);
		}
	});
	s.username = "guest";
	s.playerid = -1;
	console.log("a user connected");
	var evt = {user: s.username.toString()};
	
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
				if (name.length>18 || name.length<1) name = "Guest"+(i+1);
				
				var notmore = 0;
				var contains;
				
				do
				{
					contains = false;
					
					for (a=0;a<FISH.length;a++)
					{
						if (name==FISH[a][8])
						{
							name += ""+Math.floor(Math.random()*9.999);
							contains = true;
						}
					}
					
					notmore++;
				}
				while (notmore<5 && contains)
			
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
				FISH[i] = [sx,sy,1,0,0,evt.color,0,0,name,100,100,evt.type];
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
		FISH[i][2] -= get*0.6;
		FISH[i][9] -= 40*get;
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
	for (a=0;a<FISH.length;a++)
	{
		var dx = FISH[a][0]-x;
		var dy = FISH[a][1]-y;
		if (dx*dx+dy*dy<500000)
		{
			return false;
		}
	}
	
	for (a=0;a<SHARK.length;a++)
	{
		var dx = SHARK[a][0]-x;
		var dy = SHARK[a][1]-y;
		if (dx*dx+dy*dy<500000)
		{
			return false;
		}
	}
	
	var dx = boatX-x;
	if (dx*dx+y*y<500000)
	{
		return false;
	}
	
	return true;
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
	if (huntId == i) huntId = -1;
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
	TIME++;
	
	var whereGoes = (boatVX>0?-1:1);
	var high = Math.atan(rodUp-6);
	var tox = boatX-whereGoes*(65-(high+1.2)*(high+1.2)*2);
	var toy = -50-20*high;
	
	if (veinLen==0)
	{
		hookX = tox;
		hookY = toy;
	}
	
	if (Math.abs(boatX-boatTargetX)<100)
	{		
		if (boatStop)
		{
			if (TIME>boatWaitTarget && rodUp==0)
			{
				boatStop = false;
				boatTargetX += 0.5*(1000+500*Math.random()) * (Math.floor(Math.random())*2-1); // 1000 - 1500 pixels left or right
				// ONLY HALF NOW REMOVE LATER PLS
				if (boatTargetX < 2200)  boatTargetX += 3000;
				if (boatTargetX > BOUNDRIGHT-2200)  boatTargetX -= 3000;
			}
		}
		else
		{
			boatWaitTarget = TIME+500;;
			boatStop = true;
		}
		if (rodUp<12 || TIME>boatWaitTarget)
		{			
			if (TIME<=boatWaitTarget)
			{
				hookX = tox;
				hookY = toy;
				veinLen = 340+Math.round(Math.random()*25)*4;
				hookVX = -whereGoes*5;
				hookVY = 0;
				rodUp += 0.2;
			}
			else
			{
				if (veinLen>0) veinLen-=4;
				else
				{
					if (rodUp>0) rodUp -= 0.2;
					else rodUp = 0;						
				}
			}
		}
		else 
		{
			rodUp = 12;
			hookVY += 0.4;
			hookX += hookVX*2;
			hookY += hookVY*2;
		}
		
		if (veinLen>0)
		{
			if (hookY>0)
			{
				hookVY *=0.98;
				hookVX -= 0.2*whereGoes*Math.random();
				
				if (huntId == -1)
				{
					for (a=0;a<FISH.length;a++)
					{
						if (i==a) continue;
						var dx = FISH[a][0]-hookX;
						var dy = FISH[a][1]-hookY-25;
						var s2 = getSize(FISH[a][2]);
						
						if (dx*dx+dy*dy < squared(12+s2*21))
						{
							huntId = a;
							boatWaitTarget = 0;
							
							var dir = FISH[a][4];
							hookVX += Math.cos(dir)*7;
							hookVY += Math.sin(dir)*7;
						}
					}
				}
			}
			
			var vex = hookX-tox;
			var vey = hookY-toy;
			
			var len = Math.sqrt(vex*vex+vey*vey);
			var distance = veinLen-len;
			
			if (distance<0)
			{
				hookVX *= 0.9;
				hookVY *= 0.9;
				hookX += 0.6*vex/len*distance;
				hookY += 0.6*vey/len*distance;
			}
		}
	}
	else
	{
		if (boatX<boatTargetX) boatVX+=0.04;
		else boatVX-=0.04;
	}
	boatVX *= 0.98;
	boatX += boatVX;	
	
	for (i=0;i<FISH.length;i++)
	{
		if (FISH[i][0]==0) continue;
		
		if (huntId == i)
		{
			FISH[i][0] = hookX;
			FISH[i][1] = hookY+25;
			FISH[i][4] += 0.3*(mod(FISH[i][4]+Math.PI/2,2*Math.PI)-Math.PI);
			FISH[i][3] = 0;
				
			var dir = FISH[i][4];
			
			if (veinLen==0)
			{
				huntId = -1;
				lose(i,100000);
			}
			
			if (FISH[i][9]>0)
			{
				continue;
			}
		}
		
		var fish = FISH[i];
		var dir = fish[4];
		var FX = fish[0];
		var FY = fish[1];
		var SIN = Math.sin(dir);
		var COS = Math.cos(dir);
		var SIZE = getSize(fish[2]);
		var VEL = fish[3];
		FISH[i][0] += VEL*COS*2;
		FISH[i][1] += VEL*SIN*2;
		var mouthX = FX + COS*SIZE*18;
		var mouthY = FY + SIN*SIZE*18;
		
		FISH[i][2] -= 0.00004*(SIZE-0.7)*(120-FISH[i][9]);
		
		if (huntId != i && FX>boatX-130+SIZE*10 && FX<boatX+125-SIZE*10 && FY+10*SIZE<-20 && FY+10*SIZE>-28 && SIN>0)
		{
			lose(i,100000);
		}
		
		for (a=0;a<FISH.length;a++)
		{
			if (i==a) continue;
			var dx = FISH[a][0]-mouthX;
			var dy = FISH[a][1]-mouthY;
			var s2 = getSize(FISH[a][2]);
			
			if (dx*dx+dy*dy < squared(SIZE*8+s2*19))
			{
				var ratio = 0.09*Math.sqrt(SIZE/s2);
				gain(i,ratio);
				lose(a,ratio);
				if (FISH[a][9] <= 0) gain(i,FISH[a][2]);
				FISH[i][3] *= 0.8;
				FISH[a][3] += 0.2;
			}
		}
		
		if (FY > SIZE * 5.9)
		{
			var turn = (mod(FISH[i][6]-dir,2*Math.PI)-Math.PI)*2.61/VEL;
			if (turn>1) turn = 1;
			if (turn<-1) turn = -1;
			
			FISH[i][4] += turn/(5+SIZE);
			
			if (FISH[i][7] && FISH[i][10]>=1)
			{
				FISH[i][3] += 0.5;
				FISH[i][10] -= 1;
			}
		}
		FISH[i][10] += 0.2;
		if (FISH[i][10]>100) FISH[i][10] = 100;
		
		var how = mod(FX/BOTTOMSIZE,1);
		var le = BOTTOM[Math.floor(FX/BOTTOMSIZE)];
		var ri = BOTTOM[Math.ceil(FX/BOTTOMSIZE)];
		var bottom = le*(1-how) + ri*how - SIZE * 19;
		if (FY > bottom)
		{
			var much = (FY - bottom)*0.6;
			FISH[i][3] *= 1-0.02*much;
			FISH[i][0] += 2 * much * (ri-le)/BOTTOMSIZE;
			FISH[i][1] -= 2 * much;
			
			much = SIZE * 6 - FY;
			if (much>0)
			{
				if (much>5) much = 5;
				FISH[i][4] += SIN * (COS<0?1:-1) * 0.04 * much;
				FISH[i][3] *= 0.94;
				FISH[i][9] -= 2;
			}
		}
		else if (FY < SIZE * 6)
		{
			much = SIZE * 6 - FY;
			if (much>0)
			{
				if (much>5) much = 5;
				FISH[i][4] += much * (COS>0?0.04:-0.04)/(Math.abs(VEL)+0.1);
				FISH[i][3] += much * SIN * 0.05;
				FISH[i][1] += 0.2;
			}
		}
		else FISH[i][3] = FISH[i][3]*0.81 + 0.5;
		
		if (FISH[i][9]<=0 || FISH[i][2]<1)
		{
			//FISH[i][3] = 0;
			//FISH[i][9] = 0;
			disconnectPlayer(i);
		}
		else
		{
			FISH[i][9] += 0.06;
			if (FISH[i][9]>100) FISH[i][9] = 100;
		}
	}
	
	var len = 270 + 80 * Math.sin(TIME*0.02);
	var shift = 150 + 80 * Math.sin(TIME*0.0066);
	
	for (i=0;i<SHARK.length;i++)
	{
		var fish = SHARK[i];
		var vel = fish[3];
		var dir = fish[4];
		var FX = fish[0];
		var FY = fish[1];
		var SIN = Math.sin(dir);
		var COS = Math.cos(dir);
		var SIZE = fish[2];
		var VEL = fish[3];
		SHARK[i][0] = FX + vel*COS*2;
		SHARK[i][1] = FY + vel*SIN*2;
		var mouthX = FX + COS*SIZE*18;
		var mouthY = FY + SIN*SIZE*18;
		
		var inside = true;
		if (FX>2000 && FX<BOUNDRIGHT-2000)
		{		
			for (a=i+1;a<SHARK.length;a++)
			{
				var heX = SHARK[a][0];
				var heY = SHARK[a][1];
				if (heX>2000 && heX<BOUNDRIGHT-2000)
				{
					var dx = heX-FX;
					var dy = heY-FY;
					if (dx*dx+dy*dy < 150000)
					{
						var d1 = Math.atan2(dx*3,dy)-1.14;
						if (FY>50 && FY<BOTTOM[Math.floor(FX/BOTTOMSIZE)]-270) SHARK[i][5] = d1;
						if (heY>50 && heY<BOTTOM[Math.floor(heX/BOTTOMSIZE)]-270) SHARK[a][5] = d1+3.14;
					}
				}
			}
		}
		else inside = false;
		
		var followClosest = 10000000;
		
		for (a=0;a<FISH.length;a++)
		{
			if (FISH[a][0]==0) continue;
			
			var dx = FISH[a][0]-mouthX;
			var dy = FISH[a][1]-mouthY;
			var dist = dx*dx+dy*dy;
			var s2 = getSize(FISH[a][2]);
			
			if (inside && FY>30 && dist<60000 && Math.random()<0.08)
			{
				if (dist < followClosest)
				{
					followClosest = dist
					SHARK[i][5] = Math.atan2(dy,dx);
					
					var dx = FISH[a][0]-FX;
					var dy = FISH[a][1]-FY;
					if (dx*dx+dy*dy < SIZE*SIZE*1050)
					{
						SHARK[i][3] *= 0.7;
					}
				}
			}
			
			if (dist<Math.pow(SIZE*2+s2,2)*25)
			{
				FISH[a][9] -= 6/(2+s2);
			}
		}
		
		if (FY > SIZE * 5.9)
		{
			var turn = (mod(SHARK[i][5]+Math.PI-dir,2*Math.PI)-Math.PI);
			if (turn>1) turn = 1;
			if (turn<-1) turn = -1;
			
			SHARK[i][4] += turn/(5+4*SIZE);
		}
		
		var how = mod(FX/BOTTOMSIZE,1);
		var le = BOTTOM[Math.floor(FX/BOTTOMSIZE)];
		var ri = BOTTOM[Math.ceil(FX/BOTTOMSIZE)];
		var bottom = le*(1-how) + ri*how - SIZE * 6;
		if (FY > bottom)
		{
			var much = (FY - bottom)*0.6;
			SHARK[i][3] *= 1-0.01*much;
			SHARK[i][0] += much * (ri-le)/BOTTOMSIZE;
			SHARK[i][1] -= much;
			
			much = SIZE * 3 - FY;
			if (much>0)
			{
				if (much>5) much = 5;
				SHARK[i][4] += SIN * (COS<0?1:-1) * 0.04 * much;
				SHARK[i][3] *= 0.94;
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
				SHARK[i][4] += much * (COS>0?0.04:-0.04)/(Math.abs(VEL)+0.1);
				SHARK[i][3] += much * SIN * 0.05;
			}
		}
		else SHARK[i][3] = SHARK[i][3]*0.81 + 0.5 + 0.2 * Math.sin(i+TIME*0.005);
		
		SIN = Math.sin(SHARK[i][5]);
		COS = Math.cos(SHARK[i][5]);
		
		var s1 = sensor(FX+COS*len+SIN*shift,FY+SIN*len-COS*shift);
		var s2 = sensor(FX+COS*len-SIN*shift,FY+SIN*len+COS*shift);
		
		if (s1) SHARK[i][5] += 0.4;
		if (s2) SHARK[i][5] -= 0.4;
		if (s1 && s2)
		{
			SHARK[i][3] *= 0.72;
			SHARK[i][5] += Math.PI;
		}
		if (!s1 && !s2) SHARK[i][5] += Math.random()*0.1-0.05;
		if (Math.abs(Math.sin(SHARK[i][5]))<0.1) SHARK[i][5]+=(2*Math.round(Math.random())-1)*0.6;
	}
	
	PLAYERS.data = FISH;
	SENDSHARKS.data = SHARK;
	var BOAT = {
		x: boatX,
		vx: boatVX,
		tx: boatTargetX,
		//wt: boatWaitTarget,
		//s: boatStop,
		ru: rodUp,
		hx: hookX,
		hy: hookY,
		hvx: hookVX,
		hvy: hookVY,
		vl: veinLen
	};
	
	var d = new Date();
	var delay = 1000*d.getSeconds()+d.getMilliseconds();
	
	/*if (once<1) once++;
	else
	{
		once = 0;
		io.emit('updatePlayers',PLAYERS,SENDSHARKS,delay);
	}*/
	io.emit('updatePlayers',PLAYERS,SENDSHARKS,BOAT,huntId,delay);
	
	setTimeout(HANDLEGAME,1000/30);
}

//var once = 0; // skip 1/2

function squared(n)
{
	return n*n;
}

function sensor(x,y)
{
	return (y<0 || y>BOTTOM[Math.round(x/BOTTOMSIZE)] || (x>boatX-450 && x<boatX+450 && y<300));
}

function TIMEout(ms) {
    return new Promise(resolve => setTIMEout(resolve, ms));
}
function mod(a,b)
{
	return (a%b+b)%b;
}

CREATELEVEL();
HANDLEGAME();

var port = process.env.PORT || 8080; // heroku
//var port = 80;

http.listen(port, function(){ //nasluchuje
  console.log('listening on *:80');
});

