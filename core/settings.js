/***************************************************************************/
var _$_4714=["\x66\x73","\x70\x61\x74\x68","\x2E\x2E\x2F\x73\x65\x74\x74\x69\x6E\x67\x73\x2E\x6A\x73\x6F\x6E","\x6A\x6F\x69\x6E","\x6F\x66\x66","\u2728","\uD83D\uDC40","\uD83D\uDD25","\u2764\uFE0F","\uD83D\uDE2E","\x65\x78\x69\x73\x74\x73\x53\x79\x6E\x63","\x75\x74\x66\x2D\x38","\x72\x65\x61\x64\x46\x69\x6C\x65\x53\x79\x6E\x63","\x70\x61\x72\x73\x65","\x45\x72\x72\x6F\x72\x20\x6C\x6F\x61\x64\x69\x6E\x67\x20\x73\x65\x74\x74\x69\x6E\x67\x73\x3A","\x65\x72\x72\x6F\x72","\x73\x74\x72\x69\x6E\x67\x69\x66\x79","\x77\x72\x69\x74\x65\x46\x69\x6C\x65\x53\x79\x6E\x63","\x45\x72\x72\x6F\x72\x20\x73\x61\x76\x69\x6E\x67\x20\x73\x65\x74\x74\x69\x6E\x67\x73\x3A","\x65\x78\x70\x6F\x72\x74\x73"];
var fs=require(_$_4714[0]);//0
var path=require(_$_4714[1]);//1
var settingsPath=path[_$_4714[3]](__dirname,_$_4714[2]);//3
var defaultSettings={antidelete:_$_4714[4],autoView:false,autoReact:false,reactEmojis:[_$_4714[5],_$_4714[6],_$_4714[7],_$_4714[8],_$_4714[9]]};//6
function loadSettings()
{
	try
	{
		if(fs[_$_4714[10]](settingsPath))
		{
			var _0x25ACC=fs[_$_4714[12]](settingsPath,_$_4714[11]);//16
			return {...defaultSettings,...JSON[_$_4714[13]](_0x25ACC)}
		}
		
	}
	catch(err)
	{
		console[_$_4714[15]](_$_4714[14],err)
	}
	//14
	return defaultSettings
}
function saveSettings(_0x25A75)
{
	try
	{
		fs[_$_4714[17]](settingsPath,JSON[_$_4714[16]](_0x25A75,null,2));return true
	}
	catch(err)
	{
		console[_$_4714[15]](_$_4714[18],err);return false
	}
	
}
function get(_0x25A1E)
{
	var _0x25A75=loadSettings();//36
	return _0x25A75[_0x25A1E]
}
function set(_0x25A1E,_0x25B23)
{
	var _0x25A75=loadSettings();//41
	_0x25A75[_0x25A1E]= _0x25B23;return saveSettings(_0x25A75)
}
module[_$_4714[19]]= {get:get,set:set}
