package main

import (
	"html/template"
	"log"
	"net/http"
)

type stock struct {
	Total  int
	Active int
}

var summary = template.Must(template.New("stock").Parse(
	"<strong>{{.Total}} products</strong> · {{.Active}} active",
))

func stockSummary(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := summary.Execute(w, stock{Total: 6, Active: 4}); err != nil {
		log.Print(err)
	}
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "index.html")
	})
	mux.Handle("GET /ui/", http.StripPrefix("/ui/", http.FileServer(http.Dir("../../ui"))))
	mux.Handle("GET /vendor/", http.StripPrefix("/vendor/", http.FileServer(http.Dir("../../public/vendor"))))
	mux.HandleFunc("GET /demo/stock-summary", stockSummary)
	log.Fatal(http.ListenAndServe("127.0.0.1:4180", mux))
}
