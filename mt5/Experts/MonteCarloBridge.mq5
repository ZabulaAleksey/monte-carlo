//+------------------------------------------------------------------+
//| MonteCarloBridge.mq5                                             |
//| Read-only data bridge from MetaTrader 5 to the analytics API.    |
//+------------------------------------------------------------------+
#property strict
#property version   "2.41"
#property description "Read-only bridge. It never sends trading orders."

input string BridgeBaseUrl       = "http://127.0.0.1:8000";
input string BridgeTerminalId    = "mt5-terminal-01";
input string MT5_API_KEY         = "replace-with-at-least-32-random-characters";
input int    HeartbeatSeconds    = 30;
input int    QuoteMilliseconds   = 500;
input int    PositionMilliseconds = 500;
input int    AccountMilliseconds = 1000;
input int    TradeRetrySeconds   = 5;
input bool   IncludeAllBrokerQuotes = true;
input int    HistoryRequestSeconds = 1;
input int    SynchronizeSeconds  = 60;
input int    RequestTimeoutMs    = 5000;
input int    RetryCount          = 3;
input int    BackgroundRequestTimeoutMs = 1000;
input ENUM_TIMEFRAMES CandleTimeframe = PERIOD_H1;
input int    CandleBatchSize     = 100;
input int    CandleLookbackDays  = 3650;
input int    TradeBatchSize      = 200;
input int    TradeLookbackDays   = 30;

datetime g_last_sync_at = 0;
datetime g_last_heartbeat_at = 0;
ulong    g_last_quote_at_ms = 0;
ulong    g_last_position_at_ms = 0;
ulong    g_last_account_at_ms = 0;
datetime g_last_trade_sync_at = 0;
bool     g_trade_sync_pending = true;
datetime g_last_history_request_at = 0;
datetime g_last_trade_at = 0;
string   g_symbol_names[];
datetime g_last_candle_at[];
string   g_quote_symbol_names[];
long     g_last_quote_msc[];
int      g_symbol_catalog_cursor = 0;
int      g_quote_cursor = 0;
bool     g_symbol_catalog_pending = true;
string   g_priority_quote_symbol = "";
int      g_priority_quote_index = -1;
int      g_chart_quote_index = -1;
int      g_fx_quote_indexes[];
int      g_fx_quote_cursor = 0;

string JsonEscape(string value)
  {
   StringReplace(value,"\\","\\\\");
   StringReplace(value,"\"","\\\"");
   StringReplace(value,"\r","\\r");
   StringReplace(value,"\n","\\n");
   StringReplace(value,"\t","\\t");
   return value;
  }

string JsonString(const string value)
  {
   return "\""+JsonEscape(value)+"\"";
  }

string JsonNumber(const double value,const int digits=8)
  {
   return DoubleToString(value,digits);
  }

string JsonOptionalPrice(const double value,const int digits)
  {
   if(value<=0.0)
      return "null";
   return DoubleToString(value,digits);
  }

datetime ServerTimeToUtc(const datetime server_time)
  {
   datetime trade_server=TimeTradeServer();
   datetime utc_now=TimeGMT();
   if(trade_server<=0 || utc_now<=0)
      return server_time;
   return (datetime)((long)server_time-((long)trade_server-(long)utc_now));
  }

string IsoUtc(const datetime utc_time)
  {
   MqlDateTime parts;
   TimeToStruct(utc_time,parts);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                       parts.year,parts.mon,parts.day,
                       parts.hour,parts.min,parts.sec);
  }

string ServerIsoUtc(const datetime server_time)
  {
   return IsoUtc(ServerTimeToUtc(server_time));
  }

string TimeframeName()
  {
   string value=EnumToString(CandleTimeframe);
   StringReplace(value,"PERIOD_","");
   return value;
  }

ENUM_TIMEFRAMES TimeframeFromName(string value)
  {
   StringToUpper(value);
   if(value=="M1")  return PERIOD_M1;
   if(value=="M2")  return PERIOD_M2;
   if(value=="M3")  return PERIOD_M3;
   if(value=="M4")  return PERIOD_M4;
   if(value=="M5")  return PERIOD_M5;
   if(value=="M6")  return PERIOD_M6;
   if(value=="M10") return PERIOD_M10;
   if(value=="M12") return PERIOD_M12;
   if(value=="M15") return PERIOD_M15;
   if(value=="M20") return PERIOD_M20;
   if(value=="M30") return PERIOD_M30;
   if(value=="H1")  return PERIOD_H1;
   if(value=="H2")  return PERIOD_H2;
   if(value=="H3")  return PERIOD_H3;
   if(value=="H4")  return PERIOD_H4;
   if(value=="H6")  return PERIOD_H6;
   if(value=="H8")  return PERIOD_H8;
   if(value=="H12") return PERIOD_H12;
   if(value=="D1")  return PERIOD_D1;
   if(value=="W1")  return PERIOD_W1;
   if(value=="MN1") return PERIOD_MN1;
   return PERIOD_CURRENT;
  }

datetime UtcTimeToServer(const datetime utc_time)
  {
   datetime trade_server=TimeTradeServer();
   datetime utc_now=TimeGMT();
   if(trade_server<=0 || utc_now<=0)
      return utc_time;
   return (datetime)((long)utc_time+((long)trade_server-(long)utc_now));
  }

datetime ParseIsoUtc(string value)
  {
   StringReplace(value,"T"," ");
   StringReplace(value,"Z","");
   if(StringLen(value)>19)
      value=StringSubstr(value,0,19);
   return StringToTime(value);
  }

bool IsTemporaryHttpStatus(const int status_code)
  {
   return status_code==-1 || status_code==408 || status_code==429 || status_code>=500;
  }

bool HttpPostWithPolicy(const string path,const string body,
                        const int timeout_ms,const int retry_count)
  {
   string url=BridgeBaseUrl+path;
   string headers="Content-Type: application/json\r\n"+
                  "X-MT5-API-Key: "+MT5_API_KEY+"\r\n";
   char data[];
   int copied=StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);
   if(copied>0 && data[copied-1]==0)
      ArrayResize(data,copied-1);

   for(int attempt=0;attempt<=retry_count;attempt++)
     {
      char result[];
      string response_headers;
      ResetLastError();
      int status_code=WebRequest("POST",url,headers,timeout_ms,
                                 data,result,response_headers);
      if(status_code>=200 && status_code<300)
         return true;

      int error_code=GetLastError();
      PrintFormat("MonteCarlo bridge request failed: endpoint=%s status=%d error=%d attempt=%d",
                  path,status_code,error_code,attempt+1);
      if(!IsTemporaryHttpStatus(status_code) || attempt>=retry_count)
         return false;
      Sleep(250*(attempt+1));
     }
  return false;
  }

bool HttpPost(const string path,const string body)
  {
   return HttpPostWithPolicy(path,body,RequestTimeoutMs,RetryCount);
  }

bool HttpPostBackground(const string path,const string body)
  {
   return HttpPostWithPolicy(path,body,
                             MathMax(100,MathMin(RequestTimeoutMs,
                                                 BackgroundRequestTimeoutMs)),0);
  }

int HttpGet(const string path,string &body)
  {
   string url=BridgeBaseUrl+path;
   string headers="X-MT5-API-Key: "+MT5_API_KEY+"\r\n";
   char data[];
   ArrayResize(data,0);
   for(int attempt=0;attempt<=RetryCount;attempt++)
     {
      char result[];
      string response_headers;
      ResetLastError();
      int status_code=WebRequest("GET",url,headers,RequestTimeoutMs,
                                 data,result,response_headers);
      body=CharArrayToString(result,0,WHOLE_ARRAY,CP_UTF8);
      if(status_code>=200 && status_code<300)
         return status_code;
      int error_code=GetLastError();
      PrintFormat("MonteCarlo bridge request failed: endpoint=%s status=%d error=%d attempt=%d",
                  path,status_code,error_code,attempt+1);
      if(!IsTemporaryHttpStatus(status_code) || attempt>=RetryCount)
         return status_code;
      Sleep(250*(attempt+1));
     }
   return -1;
  }

string JsonStringValue(const string json,const string key)
  {
   string marker="\""+key+"\":\"";
   int start=StringFind(json,marker);
   if(start<0)
      return "";
   start+=StringLen(marker);
   int finish=StringFind(json,"\"",start);
   if(finish<0)
      return "";
   return StringSubstr(json,start,finish-start);
  }

string RequestPrefix()
  {
   return "{\"terminal_id\":"+JsonString(BridgeTerminalId)+
          ",\"sent_at\":"+JsonString(IsoUtc(TimeGMT()));
  }

bool SendHeartbeat()
  {
   string account_id=IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string body=RequestPrefix()+
               ",\"terminal_name\":"+JsonString(TerminalInfoString(TERMINAL_NAME))+
               ",\"terminal_build\":"+IntegerToString(TerminalInfoInteger(TERMINAL_BUILD))+
               ",\"account_external_id\":"+JsonString(account_id)+"}";
   return HttpPost("/api/v1/mt5/heartbeat",body);
  }

bool SendAccount()
  {
   string account_id=IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string body=RequestPrefix()+
               ",\"external_id\":"+JsonString(account_id)+
               ",\"name\":"+JsonString(AccountInfoString(ACCOUNT_NAME))+
               ",\"currency\":"+JsonString(AccountInfoString(ACCOUNT_CURRENCY))+
               ",\"balance\":"+JsonNumber(AccountInfoDouble(ACCOUNT_BALANCE),8)+
               ",\"equity\":"+JsonNumber(AccountInfoDouble(ACCOUNT_EQUITY),8)+
               ",\"margin\":"+JsonNumber(AccountInfoDouble(ACCOUNT_MARGIN),8)+
               ",\"free_margin\":"+JsonNumber(AccountInfoDouble(ACCOUNT_MARGIN_FREE),8)+
               ",\"leverage\":"+IntegerToString(AccountInfoInteger(ACCOUNT_LEVERAGE))+
               ",\"company\":"+JsonString(AccountInfoString(ACCOUNT_COMPANY))+
               ",\"server\":"+JsonString(AccountInfoString(ACCOUNT_SERVER))+"}";
   bool sent=HttpPost("/api/v1/mt5/account",body);
   if(sent)
      g_last_account_at_ms=GetTickCount64();
   return sent;
  }

void InitializeCandleSymbols()
  {
   // Quote discovery may select thousands of broker instruments. Periodic
   // candle backfill must remain bounded; other symbol/timeframe pairs are
   // loaded on demand through HistoricalDataRequest.
   ArrayResize(g_symbol_names,1);
   ArrayResize(g_last_candle_at,1);
   g_symbol_names[0]=_Symbol;
   g_last_candle_at[0]=0;
  }

void RefreshQuoteSymbolState()
  {
   bool selected_only=!IncludeAllBrokerQuotes;
   int total=SymbolsTotal(selected_only);
   int previous=ArraySize(g_quote_symbol_names);
   g_priority_quote_index=-1;
   g_chart_quote_index=-1;
   ArrayResize(g_fx_quote_indexes,0);
   ArrayResize(g_quote_symbol_names,total);
   ArrayResize(g_last_quote_msc,total);
   for(int i=0;i<total;i++)
     {
      string name=SymbolName(i,selected_only);
      if(i>=previous || g_quote_symbol_names[i]!=name)
         g_last_quote_msc[i]=0;
      g_quote_symbol_names[i]=name;
      if(name==g_priority_quote_symbol)
         g_priority_quote_index=i;
      if(name==_Symbol)
         g_chart_quote_index=i;
      long calc_mode=SymbolInfoInteger(name,SYMBOL_TRADE_CALC_MODE);
      if(calc_mode==SYMBOL_CALC_MODE_FOREX ||
         calc_mode==SYMBOL_CALC_MODE_FOREX_NO_LEVERAGE)
        {
         int fx_count=ArraySize(g_fx_quote_indexes);
         ArrayResize(g_fx_quote_indexes,fx_count+1);
         g_fx_quote_indexes[fx_count]=i;
        }
      if(IncludeAllBrokerQuotes && !SymbolInfoInteger(name,SYMBOL_SELECT))
         SymbolSelect(name,true);
     }
   g_symbol_catalog_cursor=0;
   g_symbol_catalog_pending=(total>0);
   if(g_quote_cursor>=total)
      g_quote_cursor=0;
   if(g_fx_quote_cursor>=ArraySize(g_fx_quote_indexes))
      g_fx_quote_cursor=0;
  }

void SetPriorityQuoteSymbol(const string symbol)
  {
   if(StringLen(symbol)==0)
      return;
   g_priority_quote_symbol=symbol;
   g_priority_quote_index=-1;
   for(int i=0;i<ArraySize(g_quote_symbol_names);i++)
     {
      if(g_quote_symbol_names[i]==symbol)
        {
         g_priority_quote_index=i;
         return;
        }
     }
  }

bool SendFxQuotes()
  {
   int total=ArraySize(g_fx_quote_indexes);
   if(total<=0)
      return true;
   int start=MathMax(0,MathMin(g_fx_quote_cursor,total-1));
   int finish=MathMin(total,start+500);
   string items="";
   int accepted=0;
   int batch_indexes[];
   long batch_times[];
   for(int position=start;position<finish;position++)
     {
      int index=g_fx_quote_indexes[position];
      if(index<0 || index>=ArraySize(g_quote_symbol_names))
         continue;
      string symbol=g_quote_symbol_names[index];
      MqlTick tick;
      if(!SymbolInfoTick(symbol,tick) || tick.bid<=0.0 || tick.ask<=0.0 ||
         tick.time_msc<=g_last_quote_msc[index])
         continue;
      int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
      if(accepted>0)
         items+=",";
      items+="{"+JsonString("symbol")+":"+JsonString(symbol)+
             ","+JsonString("bid")+":"+JsonNumber(tick.bid,digits)+
             ","+JsonString("ask")+":"+JsonNumber(tick.ask,digits)+
             ","+JsonString("observed_at")+":"+
             JsonString(ServerIsoUtc((datetime)tick.time))+"}";
      ArrayResize(batch_indexes,accepted+1);
      ArrayResize(batch_times,accepted+1);
      batch_indexes[accepted]=index;
      batch_times[accepted]=tick.time_msc;
      accepted++;
     }
   if(accepted>0)
     {
      if(!HttpPostBackground("/api/v1/mt5/quotes",
                             RequestPrefix()+","+JsonString("quotes")+":["+items+"]}"))
         return false;
      for(int i=0;i<accepted;i++)
         g_last_quote_msc[batch_indexes[i]]=batch_times[i];
     }
   g_fx_quote_cursor=(finish>=total ? 0 : finish);
   return true;
  }

bool SendQuoteAtIndex(const int index)
  {
   if(index<0 || index>=ArraySize(g_quote_symbol_names))
      return true;
   string symbol=g_quote_symbol_names[index];
   MqlTick tick;
   if(!SymbolInfoTick(symbol,tick) || tick.bid<=0.0 || tick.ask<=0.0)
      return true;
   if(tick.time_msc<=g_last_quote_msc[index])
      return true;
   int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
   string item="{"+JsonString("symbol")+":"+JsonString(symbol)+
               ","+JsonString("bid")+":"+JsonNumber(tick.bid,digits)+
               ","+JsonString("ask")+":"+JsonNumber(tick.ask,digits)+
               ","+JsonString("observed_at")+":"+
               JsonString(ServerIsoUtc((datetime)tick.time))+"}";
   if(!HttpPostBackground("/api/v1/mt5/quotes",
                          RequestPrefix()+","+JsonString("quotes")+":["+item+"]}"))
      return false;
   g_last_quote_msc[index]=tick.time_msc;
   return true;
  }

bool SendPriorityQuote()
  {
   bool success=SendQuoteAtIndex(g_chart_quote_index);
   if(g_priority_quote_index!=g_chart_quote_index &&
      !SendQuoteAtIndex(g_priority_quote_index))
      success=false;
   return success;
  }

bool SendSymbols()
  {
   int total=ArraySize(g_quote_symbol_names);
   if(total<=0)
     {
      g_symbol_catalog_pending=false;
      return true;
     }
   int start=MathMax(0,MathMin(g_symbol_catalog_cursor,total-1));
   int finish=MathMin(total,start+500);
   string items="";
   int accepted=0;
   for(int i=start;i<finish;i++)
     {
      string symbol=g_quote_symbol_names[i];
      double volume_min=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MIN);
      double volume_step=SymbolInfoDouble(symbol,SYMBOL_VOLUME_STEP);
      double volume_max=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MAX);
      double contract_size=SymbolInfoDouble(symbol,SYMBOL_TRADE_CONTRACT_SIZE);
      // Quote-only broker instruments may omit trading constraints. Keep them
      // visible in Market Data while satisfying the backend symbol contract.
      if(volume_min<=0.0)
         volume_min=0.01;
      volume_min=MathMin(99.0,volume_min);
      if(volume_step<=0.0)
         volume_step=volume_min;
      if(volume_max<volume_min)
         volume_max=volume_min;
      volume_max=MathMin(99.0,volume_max);
      if(contract_size<=0.0)
         contract_size=1.0;
      if(accepted>0)
         items+=",";
      items+="{\"name\":"+JsonString(symbol)+
             ",\"description\":"+JsonString(SymbolInfoString(symbol,SYMBOL_DESCRIPTION))+
             ",\"digits\":"+IntegerToString(SymbolInfoInteger(symbol,SYMBOL_DIGITS))+
             ",\"volume_min\":"+JsonNumber(volume_min,8)+
             ",\"volume_step\":"+JsonNumber(volume_step,8)+
             ",\"volume_max\":"+JsonNumber(volume_max,8)+
             ",\"contract_size\":"+JsonNumber(contract_size,8)+
             ",\"is_active\":true}";
      accepted++;
      if(accepted>=500)
        {
         if(!HttpPostBackground("/api/v1/mt5/symbols",
                      RequestPrefix()+",\"symbols\":["+items+"]}"))
            return false;
         items="";
         accepted=0;
        }
     }
   if(accepted>0 && !HttpPostBackground("/api/v1/mt5/symbols",
                              RequestPrefix()+",\"symbols\":["+items+"]}"))
      return false;
   g_symbol_catalog_cursor=finish;
   if(g_symbol_catalog_cursor>=total)
     {
      g_symbol_catalog_cursor=0;
      g_symbol_catalog_pending=false;
     }
   return true;
  }

bool SendQuotes()
  {
   int total=ArraySize(g_quote_symbol_names);
   if(total<=0)
      return true;
   int start=MathMax(0,MathMin(g_quote_cursor,total-1));
   int finish=MathMin(total,start+500);
   string items="";
   int accepted=0;
   int batch_indexes[];
   long batch_times[];
   for(int i=start;i<finish;i++)
     {
      string symbol=g_quote_symbol_names[i];
      MqlTick tick;
      if(!SymbolInfoTick(symbol,tick) || tick.bid<=0.0 || tick.ask<=0.0)
         continue;
      if(tick.time_msc<=g_last_quote_msc[i])
         continue;
      int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
      if(accepted>0)
         items+=",";
      items+="{\"symbol\":"+JsonString(symbol)+
             ",\"bid\":"+JsonNumber(tick.bid,digits)+
             ",\"ask\":"+JsonNumber(tick.ask,digits)+
             ",\"observed_at\":"+JsonString(ServerIsoUtc((datetime)tick.time))+"}";
      ArrayResize(batch_indexes,accepted+1);
      ArrayResize(batch_times,accepted+1);
      batch_indexes[accepted]=i;
      batch_times[accepted]=tick.time_msc;
      accepted++;
      if(accepted>=500)
        {
         if(!HttpPostBackground("/api/v1/mt5/quotes",
                      RequestPrefix()+",\"quotes\":["+items+"]}"))
            return false;
         for(int j=0;j<accepted;j++)
            g_last_quote_msc[batch_indexes[j]]=batch_times[j];
         items="";
         accepted=0;
         ArrayResize(batch_indexes,0);
         ArrayResize(batch_times,0);
        }
     }
   if(accepted>0)
     {
      if(!HttpPostBackground("/api/v1/mt5/quotes",
                   RequestPrefix()+",\"quotes\":["+items+"]}"))
         return false;
      for(int j=0;j<accepted;j++)
         g_last_quote_msc[batch_indexes[j]]=batch_times[j];
     }
   g_quote_cursor=(finish>=total ? 0 : finish);
   g_last_quote_at_ms=GetTickCount64();
   return true;
  }

bool FlushCandleBatch(const string items,const datetime newest,const int symbol_index)
  {
   string body=RequestPrefix()+",\"candles\":["+items+"]}";
   if(!HttpPost("/api/v1/mt5/candles/batch",body))
      return false;
   if(newest>g_last_candle_at[symbol_index])
      g_last_candle_at[symbol_index]=newest;
   return true;
  }

bool SendCandlesForSymbol(const int symbol_index)
  {
   string symbol=g_symbol_names[symbol_index];
   datetime previous_last=g_last_candle_at[symbol_index];
   int period_seconds=PeriodSeconds(CandleTimeframe);
   datetime to_time=TimeTradeServer()-(datetime)MathMax(1,period_seconds);
   datetime from_time=g_last_candle_at[symbol_index]>0
                      ? g_last_candle_at[symbol_index]+(datetime)MathMax(1,period_seconds)
                      : to_time-(datetime)(MathMax(1,CandleLookbackDays)*86400);
   if(from_time>to_time)
      return true;

   MqlRates rates[];
   int copied=CopyRates(symbol,CandleTimeframe,from_time,to_time,rates);
   if(copied<0)
     {
      PrintFormat("MonteCarlo bridge could not copy rates: symbol=%s error=%d",
                  symbol,GetLastError());
      return false;
     }
   if(copied==0)
      return true;

   string items="";
   int batch_size=MathMax(1,MathMin(CandleBatchSize,1000));
   datetime batch_newest=g_last_candle_at[symbol_index];
   int accepted=0;
   for(int i=0;i<copied;i++)
     {
      if(rates[i].time<=g_last_candle_at[symbol_index])
         continue;
      if(accepted>0)
         items+=",";
      items+="{\"symbol\":"+JsonString(symbol)+
             ",\"timeframe\":"+JsonString(TimeframeName())+
             ",\"open_time\":"+JsonString(ServerIsoUtc(rates[i].time))+
             ",\"open\":"+JsonNumber(rates[i].open,8)+
             ",\"high\":"+JsonNumber(rates[i].high,8)+
             ",\"low\":"+JsonNumber(rates[i].low,8)+
             ",\"close\":"+JsonNumber(rates[i].close,8)+
             ",\"volume\":"+IntegerToString(rates[i].tick_volume)+"}";
      accepted++;
      if(rates[i].time>batch_newest)
         batch_newest=rates[i].time;
      if(accepted>=batch_size)
        {
         if(!FlushCandleBatch(items,batch_newest,symbol_index))
            return false;
         items="";
         accepted=0;
        }
     }
   if(accepted>0 && !FlushCandleBatch(items,batch_newest,symbol_index))
      return false;
   string coverage=RequestPrefix()+
                   ",\"symbol\":"+JsonString(symbol)+
                   ",\"timeframe\":"+JsonString(TimeframeName())+
                   ",\"covered_start\":"+JsonString(ServerIsoUtc(rates[0].time))+
                   ",\"covered_end\":"+JsonString(ServerIsoUtc(to_time))+
                   ",\"expected_candles\":"+IntegerToString(copied)+"}";
   if(HttpPost("/api/v1/mt5/candles/coverage",coverage))
      return true;
   // Candle upserts are idempotent. Rewind the local cursor so a failed
   // coverage confirmation retries the complete interval on the next timer.
   g_last_candle_at[symbol_index]=previous_last;
   return false;
  }

bool SendCandles()
  {
   bool success=true;
   for(int i=0;i<ArraySize(g_symbol_names);i++)
      if(!SendCandlesForSymbol(i))
         success=false;
   return success;
  }

bool FailHistoricalRequest(const string request_id,const string reason)
  {
   string body=RequestPrefix()+",\"error\":"+JsonString(reason)+"}";
   return HttpPost("/api/v1/mt5/history/requests/"+request_id+"/fail",body);
  }

bool SendRequestedCandles(const string request_id,
                          const string symbol,
                          const string timeframe_name,
                          const datetime start_utc,
                          const datetime end_utc)
  {
   ENUM_TIMEFRAMES timeframe=TimeframeFromName(timeframe_name);
   if(timeframe==PERIOD_CURRENT)
      return FailHistoricalRequest(request_id,"Unsupported timeframe: "+timeframe_name);
   if(!SymbolSelect(symbol,true))
      return FailHistoricalRequest(request_id,"Broker symbol is unavailable: "+symbol);

   MqlRates rates[];
   int period_seconds=MathMax(1,PeriodSeconds(timeframe));
   datetime from_server=UtcTimeToServer(start_utc);
   datetime to_server=MathMin(UtcTimeToServer(end_utc),
                              TimeTradeServer()-(datetime)period_seconds);
   if(to_server<from_server)
      return FailHistoricalRequest(request_id,
                                   "The requested range has no completed candles yet");
   ResetLastError();
   int copied=CopyRates(symbol,timeframe,from_server,to_server,rates);
   if(copied<0)
     {
      // CopyRates starts terminal-side history synchronization asynchronously.
      // Keep the leased request claimed; the next poll retries it idempotently.
      PrintFormat("Historical request is waiting for MT5 data: request=%s symbol=%s error=%d",
                  request_id,symbol,GetLastError());
      return false;
     }
   if(copied==0)
      return FailHistoricalRequest(request_id,
                                   "No broker candles are available for the requested range");

   string items="";
   int accepted=0;
   int batch_size=MathMax(1,MathMin(CandleBatchSize,1000));
   for(int i=0;i<copied;i++)
     {
      if(accepted>0)
         items+=",";
      items+="{\"symbol\":"+JsonString(symbol)+
             ",\"timeframe\":"+JsonString(timeframe_name)+
             ",\"open_time\":"+JsonString(ServerIsoUtc(rates[i].time))+
             ",\"open\":"+JsonNumber(rates[i].open,8)+
             ",\"high\":"+JsonNumber(rates[i].high,8)+
             ",\"low\":"+JsonNumber(rates[i].low,8)+
             ",\"close\":"+JsonNumber(rates[i].close,8)+
             ",\"volume\":"+IntegerToString(rates[i].tick_volume)+"}";
      accepted++;
      if(accepted>=batch_size)
        {
         if(!HttpPost("/api/v1/mt5/candles/batch",
                      RequestPrefix()+",\"candles\":["+items+"]}"))
            return false;
         items="";
         accepted=0;
        }
     }
   if(accepted>0 && !HttpPost("/api/v1/mt5/candles/batch",
                               RequestPrefix()+",\"candles\":["+items+"]}"))
      return false;

   string completion=RequestPrefix()+
                     ",\"candle_count\":"+IntegerToString(copied)+
                     ",\"covered_start\":"+JsonString(ServerIsoUtc(rates[0].time))+
                     ",\"covered_end\":"+JsonString(ServerIsoUtc(rates[copied-1].time))+"}";
   return HttpPost("/api/v1/mt5/history/requests/"+request_id+"/complete",
                   completion);
  }

bool ProcessHistoricalRequest()
  {
   string response="";
   int status_code=HttpGet("/api/v1/mt5/history/requests/next?terminal_id="+
                           BridgeTerminalId,response);
   g_last_history_request_at=TimeLocal();
   if(status_code==204)
      return true;
   if(status_code!=200)
      return false;

   string request_id=JsonStringValue(response,"id");
   string symbol=JsonStringValue(response,"symbol");
   string timeframe=JsonStringValue(response,"timeframe");
   string start_value=JsonStringValue(response,"requested_start");
   string end_value=JsonStringValue(response,"requested_end");
   if(StringLen(request_id)==0 || StringLen(symbol)==0 ||
      StringLen(timeframe)==0 || StringLen(start_value)==0 ||
      StringLen(end_value)==0)
     {
      Print("Historical request response is malformed");
      return false;
     }
   SetPriorityQuoteSymbol(symbol);
   datetime start_utc=ParseIsoUtc(start_value);
   datetime end_utc=ParseIsoUtc(end_value);
   if(start_utc<=0 || end_utc<=start_utc)
      return FailHistoricalRequest(request_id,"Historical request dates are invalid");
   return SendRequestedCandles(request_id,symbol,timeframe,start_utc,end_utc);
  }

bool SendPositions()
  {
   string items="";
   int accepted=0;
   datetime observed_at=TimeTradeServer();
   int total=PositionsTotal();
   for(int i=0;i<total;i++)
     {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0)
         continue;
      string symbol=PositionGetString(POSITION_SYMBOL);
      int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
      string side=PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY ? "buy" : "sell";
      if(accepted>0)
         items+=",";
      items+="{\"external_id\":"+JsonString(IntegerToString(ticket))+
             ",\"symbol\":"+JsonString(symbol)+
             ",\"side\":"+JsonString(side)+
             ",\"volume\":"+JsonNumber(PositionGetDouble(POSITION_VOLUME),8)+
             ",\"open_price\":"+JsonNumber(PositionGetDouble(POSITION_PRICE_OPEN),digits)+
             ",\"current_price\":"+JsonNumber(PositionGetDouble(POSITION_PRICE_CURRENT),digits)+
             ",\"stop_loss\":"+JsonOptionalPrice(PositionGetDouble(POSITION_SL),digits)+
             ",\"take_profit\":"+JsonOptionalPrice(PositionGetDouble(POSITION_TP),digits)+
             ",\"profit\":"+JsonNumber(PositionGetDouble(POSITION_PROFIT),8)+
             ",\"swap\":"+JsonNumber(PositionGetDouble(POSITION_SWAP),8)+
             ",\"opened_at\":"+JsonString(ServerIsoUtc((datetime)PositionGetInteger(POSITION_TIME)))+
             ",\"observed_at\":"+JsonString(ServerIsoUtc(observed_at))+"}";
      accepted++;
     }
   string account_id=IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string body=RequestPrefix()+",\"account_external_id\":"+JsonString(account_id)+
               ",\"positions\":["+items+"]}";
   bool sent=HttpPost("/api/v1/mt5/positions",body);
   if(sent)
      g_last_position_at_ms=GetTickCount64();
   return sent;
  }

bool FlushTradeBatch(const string items,const datetime newest)
  {
   string account_id=IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string body=RequestPrefix()+",\"account_external_id\":"+JsonString(account_id)+
               ",\"trades\":["+items+"]}";
   if(!HttpPost("/api/v1/mt5/trades/batch",body))
      return false;
   if(newest>g_last_trade_at)
      g_last_trade_at=newest;
   return true;
  }

bool FindPositionEntry(const ulong position_id,
                       const datetime closed_at,
                       double &open_price,
                       datetime &opened_at,
                       string &side)
  {
   bool found=false;
   int total=HistoryDealsTotal();
   for(int i=0;i<total;i++)
     {
      ulong ticket=HistoryDealGetTicket(i);
      if(ticket==0 ||
         (ulong)HistoryDealGetInteger(ticket,DEAL_POSITION_ID)!=position_id)
         continue;
      ENUM_DEAL_ENTRY entry=(ENUM_DEAL_ENTRY)HistoryDealGetInteger(ticket,DEAL_ENTRY);
      if(entry!=DEAL_ENTRY_IN)
         continue;
      datetime deal_time=(datetime)HistoryDealGetInteger(ticket,DEAL_TIME);
      if(deal_time>closed_at || (found && deal_time>=opened_at))
         continue;
      ENUM_DEAL_TYPE deal_type=(ENUM_DEAL_TYPE)HistoryDealGetInteger(ticket,DEAL_TYPE);
      if(deal_type!=DEAL_TYPE_BUY && deal_type!=DEAL_TYPE_SELL)
         continue;
      open_price=HistoryDealGetDouble(ticket,DEAL_PRICE);
      opened_at=deal_time;
      side=deal_type==DEAL_TYPE_BUY ? "buy" : "sell";
      found=true;
     }
   return found;
  }

bool SendTrades()
  {
   datetime to_time=TimeTradeServer();
   if(g_last_trade_at==0)
      g_last_trade_at=to_time-(datetime)(MathMax(1,TradeLookbackDays)*86400);
   if(!HistorySelect(g_last_trade_at,to_time))
     {
      PrintFormat("MonteCarlo bridge could not select deal history: error=%d",GetLastError());
      return false;
     }

   string items="";
   int batch_count=0;
   datetime batch_newest=g_last_trade_at;
   int total=HistoryDealsTotal();
   for(int i=0;i<total;i++)
     {
      ulong ticket=HistoryDealGetTicket(i);
      if(ticket==0)
         continue;
      ENUM_DEAL_TYPE deal_type=(ENUM_DEAL_TYPE)HistoryDealGetInteger(ticket,DEAL_TYPE);
      if(deal_type!=DEAL_TYPE_BUY && deal_type!=DEAL_TYPE_SELL)
         continue;
      ENUM_DEAL_ENTRY deal_entry=(ENUM_DEAL_ENTRY)HistoryDealGetInteger(ticket,DEAL_ENTRY);
      if(deal_entry!=DEAL_ENTRY_OUT && deal_entry!=DEAL_ENTRY_OUT_BY &&
         deal_entry!=DEAL_ENTRY_INOUT)
         continue;
      string symbol=HistoryDealGetString(ticket,DEAL_SYMBOL);
      if(StringLen(symbol)==0)
         continue;
      datetime deal_time=(datetime)HistoryDealGetInteger(ticket,DEAL_TIME);
      int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
      double price=HistoryDealGetDouble(ticket,DEAL_PRICE);
      double open_price=price;
      datetime opened_at=deal_time;
      string side=deal_type==DEAL_TYPE_BUY ? "sell" : "buy";
      ulong position_id=(ulong)HistoryDealGetInteger(ticket,DEAL_POSITION_ID);
      FindPositionEntry(position_id,deal_time,open_price,opened_at,side);
      if(batch_count>0)
         items+=",";
      items+="{\"external_id\":"+JsonString(IntegerToString(ticket))+
             ",\"symbol\":"+JsonString(symbol)+
             ",\"side\":"+JsonString(side)+
             ",\"volume\":"+JsonNumber(HistoryDealGetDouble(ticket,DEAL_VOLUME),8)+
             ",\"open_price\":"+JsonNumber(open_price,digits)+
             ",\"close_price\":"+JsonNumber(price,digits)+
             ",\"opened_at\":"+JsonString(ServerIsoUtc(opened_at))+
             ",\"closed_at\":"+JsonString(ServerIsoUtc(deal_time))+
             ",\"profit\":"+JsonNumber(HistoryDealGetDouble(ticket,DEAL_PROFIT),8)+
             ",\"commission\":"+JsonNumber(HistoryDealGetDouble(ticket,DEAL_COMMISSION),8)+
             ",\"swap\":"+JsonNumber(HistoryDealGetDouble(ticket,DEAL_SWAP),8)+
             ",\"status\":\"closed\"}";
      batch_count++;
      if(deal_time>batch_newest)
         batch_newest=deal_time;
      if(batch_count>=MathMax(1,MathMin(TradeBatchSize,1000)))
        {
         if(!FlushTradeBatch(items,batch_newest))
            return false;
         items="";
         batch_count=0;
        }
     }
   if(batch_count>0 && !FlushTradeBatch(items,batch_newest))
      return false;
   return true;
  }

bool SynchronizeAll()
  {
   bool success=true;
   if(!SendAccount())   success=false;
   if(!SendPositions()) success=false;
   if(!SendTrades())    success=false;
   RefreshQuoteSymbolState();
   if(!SendSymbols())   success=false;
   if(!SendQuotes())    success=false;
   if(!SendCandles())   success=false;
   return success;
  }

int OnInit()
  {
   if(StringLen(MT5_API_KEY)<32 || StringLen(BridgeTerminalId)==0)
     {
      Print("MonteCarlo bridge configuration is incomplete. API key value is not logged.");
      return INIT_PARAMETERS_INCORRECT;
     }
   g_priority_quote_symbol=_Symbol;
   InitializeCandleSymbols();
   if(!EventSetMillisecondTimer(250))
     {
      PrintFormat("MonteCarlo bridge could not start timer: error=%d",GetLastError());
      return INIT_FAILED;
     }
   if(SendHeartbeat())
      g_last_heartbeat_at=TimeLocal();
   bool initial_sync_success=SynchronizeAll();
   g_last_sync_at=TimeLocal();
   if(initial_sync_success)
      g_trade_sync_pending=false;
   ProcessHistoricalRequest();
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
   g_trade_sync_pending=true;
  }

void OnTimer()
  {
   datetime now=TimeLocal();
   ulong now_ms=GetTickCount64();
   if(g_last_heartbeat_at==0 || now-g_last_heartbeat_at>=MathMax(5,HeartbeatSeconds))
     {
      if(SendHeartbeat())
         g_last_heartbeat_at=now;
     }
   if(g_last_account_at_ms==0 ||
      now_ms-g_last_account_at_ms>=(ulong)MathMax(250,AccountMilliseconds))
      SendAccount();
   if(g_last_position_at_ms==0 ||
      now_ms-g_last_position_at_ms>=(ulong)MathMax(100,PositionMilliseconds))
      SendPositions();
   if(g_trade_sync_pending &&
      (g_last_trade_sync_at==0 ||
       now-g_last_trade_sync_at>=MathMax(1,TradeRetrySeconds)))
     {
      g_last_trade_sync_at=now;
      if(SendTrades())
         g_trade_sync_pending=false;
     }
   SendFxQuotes();
   SendPriorityQuote();
   if(g_symbol_catalog_pending)
      SendSymbols();
   if(g_last_quote_at_ms==0 ||
      now_ms-g_last_quote_at_ms>=(ulong)MathMax(100,QuoteMilliseconds))
      SendQuotes();
   if(g_last_history_request_at==0 ||
      now-g_last_history_request_at>=MathMax(1,HistoryRequestSeconds))
      ProcessHistoricalRequest();
   if(g_last_sync_at==0 || now-g_last_sync_at>=MathMax(10,SynchronizeSeconds))
     {
      bool sync_success=SynchronizeAll();
      g_last_sync_at=now;
      if(sync_success)
         g_trade_sync_pending=false;
     }
  }

// No OnTick and no CTrade/order functions are intentionally present.
