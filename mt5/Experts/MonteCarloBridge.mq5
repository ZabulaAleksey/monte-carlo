//+------------------------------------------------------------------+
//| MonteCarloBridge.mq5                                             |
//| Read-only data bridge from MetaTrader 5 to the analytics API.    |
//+------------------------------------------------------------------+
#property strict
#property version   "2.00"
#property description "Read-only bridge. It never sends trading orders."

input string BridgeBaseUrl       = "http://127.0.0.1:8000";
input string BridgeTerminalId    = "mt5-terminal-01";
input string MT5_API_KEY         = "replace-with-at-least-32-random-characters";
input int    HeartbeatSeconds    = 30;
input int    QuoteSeconds        = 2;
input int    SynchronizeSeconds  = 60;
input int    RequestTimeoutMs    = 5000;
input int    RetryCount          = 3;
input ENUM_TIMEFRAMES CandleTimeframe = PERIOD_H1;
input int    CandleBatchSize     = 100;
input int    CandleLookbackDays  = 3650;
input int    TradeBatchSize      = 200;
input int    TradeLookbackDays   = 30;

datetime g_last_sync_at = 0;
datetime g_last_heartbeat_at = 0;
datetime g_last_quote_at = 0;
datetime g_last_trade_at = 0;
string   g_symbol_names[];
datetime g_last_candle_at[];

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

bool IsTemporaryHttpStatus(const int status_code)
  {
   return status_code==-1 || status_code==408 || status_code==429 || status_code>=500;
  }

bool HttpPost(const string path,const string body)
  {
   string url=BridgeBaseUrl+path;
   string headers="Content-Type: application/json\r\n"+
                  "X-MT5-API-Key: "+MT5_API_KEY+"\r\n";
   char data[];
   int copied=StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);
   if(copied>0 && data[copied-1]==0)
      ArrayResize(data,copied-1);

   for(int attempt=0;attempt<=RetryCount;attempt++)
     {
      char result[];
      string response_headers;
      ResetLastError();
      int status_code=WebRequest("POST",url,headers,RequestTimeoutMs,
                                 data,result,response_headers);
      if(status_code>=200 && status_code<300)
         return true;

      int error_code=GetLastError();
      PrintFormat("MonteCarlo bridge request failed: endpoint=%s status=%d error=%d attempt=%d",
                  path,status_code,error_code,attempt+1);
      if(!IsTemporaryHttpStatus(status_code) || attempt>=RetryCount)
         return false;
      Sleep(250*(attempt+1));
     }
   return false;
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
   return HttpPost("/api/v1/mt5/account",body);
  }

void RefreshSymbolState()
  {
   int total=SymbolsTotal(true);
   int previous=ArraySize(g_symbol_names);
   ArrayResize(g_symbol_names,total);
   ArrayResize(g_last_candle_at,total);
   for(int i=0;i<total;i++)
     {
      string name=SymbolName(i,true);
      if(i>=previous || g_symbol_names[i]!=name)
         g_last_candle_at[i]=0;
      g_symbol_names[i]=name;
     }
  }

bool SendSymbols()
  {
   RefreshSymbolState();
   string items="";
   for(int i=0;i<ArraySize(g_symbol_names);i++)
     {
      string symbol=g_symbol_names[i];
      if(i>0)
         items+=",";
      items+="{\"name\":"+JsonString(symbol)+
             ",\"description\":"+JsonString(SymbolInfoString(symbol,SYMBOL_DESCRIPTION))+
             ",\"digits\":"+IntegerToString(SymbolInfoInteger(symbol,SYMBOL_DIGITS))+
             ",\"volume_min\":"+JsonNumber(SymbolInfoDouble(symbol,SYMBOL_VOLUME_MIN),8)+
             ",\"volume_step\":"+JsonNumber(SymbolInfoDouble(symbol,SYMBOL_VOLUME_STEP),8)+
             ",\"volume_max\":"+JsonNumber(MathMin(99.0,SymbolInfoDouble(symbol,SYMBOL_VOLUME_MAX)),8)+
             ",\"contract_size\":"+JsonNumber(SymbolInfoDouble(symbol,SYMBOL_TRADE_CONTRACT_SIZE),8)+
             ",\"is_active\":true}";
     }
   if(StringLen(items)==0)
      return true;
   return HttpPost("/api/v1/mt5/symbols",RequestPrefix()+",\"symbols\":["+items+"]}");
  }

bool SendQuotes()
  {
   RefreshSymbolState();
   string items="";
   int accepted=0;
   for(int i=0;i<ArraySize(g_symbol_names);i++)
     {
      string symbol=g_symbol_names[i];
      MqlTick tick;
      if(!SymbolInfoTick(symbol,tick) || tick.bid<=0.0 || tick.ask<=0.0)
         continue;
      int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
      if(accepted>0)
         items+=",";
      items+="{\"symbol\":"+JsonString(symbol)+
             ",\"bid\":"+JsonNumber(tick.bid,digits)+
             ",\"ask\":"+JsonNumber(tick.ask,digits)+
             ",\"observed_at\":"+JsonString(ServerIsoUtc((datetime)tick.time))+"}";
      accepted++;
     }
   if(accepted==0)
      return true;
   bool sent=HttpPost("/api/v1/mt5/quotes",
                      RequestPrefix()+",\"quotes\":["+items+"]}");
   if(sent)
      g_last_quote_at=TimeLocal();
   return sent;
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
   return HttpPost("/api/v1/mt5/positions",body);
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
      string symbol=HistoryDealGetString(ticket,DEAL_SYMBOL);
      if(StringLen(symbol)==0)
         continue;
      datetime deal_time=(datetime)HistoryDealGetInteger(ticket,DEAL_TIME);
      int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
      string side=deal_type==DEAL_TYPE_BUY ? "buy" : "sell";
      double price=HistoryDealGetDouble(ticket,DEAL_PRICE);
      if(batch_count>0)
         items+=",";
      items+="{\"external_id\":"+JsonString(IntegerToString(ticket))+
             ",\"symbol\":"+JsonString(symbol)+
             ",\"side\":"+JsonString(side)+
             ",\"volume\":"+JsonNumber(HistoryDealGetDouble(ticket,DEAL_VOLUME),8)+
             ",\"open_price\":"+JsonNumber(price,digits)+
             ",\"close_price\":"+JsonNumber(price,digits)+
             ",\"opened_at\":"+JsonString(ServerIsoUtc(deal_time))+
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
   if(!SendSymbols())   success=false;
   if(!SendQuotes())    success=false;
   if(!SendCandles())   success=false;
   if(!SendPositions()) success=false;
   if(!SendTrades())    success=false;
   return success;
  }

int OnInit()
  {
   if(StringLen(MT5_API_KEY)<32 || StringLen(BridgeTerminalId)==0)
     {
      Print("MonteCarlo bridge configuration is incomplete. API key value is not logged.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(!EventSetTimer(1))
     {
      PrintFormat("MonteCarlo bridge could not start timer: error=%d",GetLastError());
      return INIT_FAILED;
     }
   if(SendHeartbeat())
      g_last_heartbeat_at=TimeLocal();
   if(SynchronizeAll())
      g_last_sync_at=TimeLocal();
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

void OnTimer()
  {
   datetime now=TimeLocal();
   if(g_last_heartbeat_at==0 || now-g_last_heartbeat_at>=MathMax(5,HeartbeatSeconds))
     {
      if(SendHeartbeat())
         g_last_heartbeat_at=now;
     }
   if(g_last_quote_at==0 || now-g_last_quote_at>=MathMax(1,QuoteSeconds))
      SendQuotes();
   if(g_last_sync_at==0 || now-g_last_sync_at>=MathMax(10,SynchronizeSeconds))
     {
      if(SynchronizeAll())
         g_last_sync_at=now;
     }
  }

// No OnTick and no CTrade/order functions are intentionally present.
