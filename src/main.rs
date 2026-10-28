use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // initialize tracing logger
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "shapemyimage=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let default_port = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse::<u16>()
        .unwrap_or(3000);

    let mut port = default_port;
    let listener = loop {
        let addr: SocketAddr = format!("{}:{}", host, port).parse()?;
        match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => {
                println!("======================================================");
                println!("  ShapeMyImage — Production Web Application");
                println!("  Tagline: Make every image fit your shape.");
                println!("  Listening on http://localhost:{}", port);
                println!("======================================================");
                break l;
            }
            Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => {
                eprintln!("Notice: Port {} is already in use by another instance.", port);
                if port >= default_port + 10 {
                    return Err(format!("Could not bind to any port between {} and {}", default_port, port).into());
                }
                port += 1;
                eprintln!("Trying next available port: http://localhost:{}...", port);
            }
            Err(e) => return Err(e.into()),
        }
    };

    let app = shapemyimage::create_app();
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    println!("Server shutdown gracefully.");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => println!("Received Ctrl+C, initiating shutdown..."),
        _ = terminate => println!("Received terminate signal, initiating shutdown..."),
    }
}
