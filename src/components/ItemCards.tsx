interface CardProps {
    title: string[]
    title2: string[]
    title3: string[]
    body: string[]
}

export function ItemCards({title} : CardProps) {
  const CardStyle = {
    backgroundColor: "rgba(18, 152, 58, 0.87)",
    fontFamily: "sans-serif",
  };

  return (
    <div className="card-group" style={CardStyle}>
      <div className="card">
        <div className="card-body">
          <h5 className="card-title">{title}</h5>
          <p className="card-text">
            <button type="button" className="btn btn-dark">Add to Order</button>
          </p>
        </div>
      </div>
      <div className="card">
        <div className="card-body">
          <h5 className="card-title">{title}</h5>
          <p className="card-text">
          </p>
        </div>
      </div>
      <div className="card">
        <div className="card-body">
          <h5 className="card-title">{title}</h5>
          <p className="card-text">
          </p>
        </div>
      </div>
    </div>
  );
}
