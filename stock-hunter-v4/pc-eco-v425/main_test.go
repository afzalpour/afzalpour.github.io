package main

import (
	"fmt"
	"math"
	"testing"
)

func closeTo(a,b,eps float64) bool { return math.Abs(a-b)<=eps }

func TestBookImbalance3(t *testing.T){
	b:=BookSnap{Levels:[3]BookLevelSnap{
		{BidP:100,BidQ:200,AskP:101,AskQ:100},
		{BidP:99,BidQ:150,AskP:102,AskQ:100},
		{BidP:98,BidQ:150,AskP:103,AskQ:100},
	}}
	if !closeTo(bookImbalance3(b),0.25,1e-9){t.Fatalf("imbalance=%v",bookImbalance3(b))}
}

func TestMLOFIPriceAware(t *testing.T){
	old:=BookSnap{Levels:[3]BookLevelSnap{
		{BidP:100,BidQ:100,AskP:101,AskQ:100},
		{BidP:99,BidQ:100,AskP:102,AskQ:100},
		{BidP:98,BidQ:100,AskP:103,AskQ:100},
	}}
	cur:=BookSnap{Levels:[3]BookLevelSnap{
		{BidP:101,BidQ:120,AskP:102,AskQ:80},
		{BidP:100,BidQ:110,AskP:103,AskQ:90},
		{BidP:99,BidQ:105,AskP:104,AskQ:95},
	}}
	v:=mlofi3(old,cur)
	if v<=0{t.Fatalf("expected positive mlofi, got %v",v)}
}

func TestCancellationProxyExplainedByTrades(t *testing.T){
	old:=BookSnap{Volume:1000,Levels:[3]BookLevelSnap{
		{BidP:100,BidQ:100,AskP:101,AskQ:100},
		{BidP:99,BidQ:100,AskP:102,AskQ:100},
		{BidP:98,BidQ:100,AskP:103,AskQ:100},
	}}
	cur:=BookSnap{Volume:1300,Levels:[3]BookLevelSnap{
		{BidP:100,BidQ:50,AskP:101,AskQ:50},
		{BidP:99,BidQ:100,AskP:102,AskQ:100},
		{BidP:98,BidQ:100,AskP:103,AskQ:100},
	}}
	if v:=cancellationProxy(old,cur);v!=0{t.Fatalf("trade-explained depth loss should be 0, got %v",v)}
}

func TestPersistence(t *testing.T){
	books:=[]BookSnap{}
	for i:=0;i<4;i++{
		books=append(books,BookSnap{Levels:[3]BookLevelSnap{
			{BidP:100,BidQ:200,AskP:101,AskQ:100},
			{BidP:99,BidQ:200,AskP:102,AskQ:100},
			{BidP:98,BidQ:200,AskP:103,AskQ:100},
		}})
	}
	if v:=bookPersistence(books);v!=1{t.Fatalf("persistence=%v",v)}
}

func TestVolumeProfileNeedsThreePriorSessions(t *testing.T){
	v:=newVolumeProfile();v.path=t.TempDir()+"/profile.json"
	for d:=1;d<=3;d++{
		v.rollDate(fmt.Sprintf("2026-09-%02d",d))
		v.observe("1",540,100)
	}
	v.rollDate("2026-09-04")
	r,n:=v.observe("1",540,150)
	if n<3{t.Fatalf("samples=%d",n)}
	if !closeTo(r,1.5,1e-9){t.Fatalf("rvol=%v",r)}
}

