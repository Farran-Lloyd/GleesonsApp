interface TitleProps{
    title: string[]
}

export function Title ({title} : TitleProps) {
    const TitleStyle = {
        backgroundColor: "rgba(255, 255, 255, 0.87)",
        fontFamily: "sans-serif",
        padding: 15
    };

    return (
        <div style={TitleStyle}>
            <h5>{title}</h5>
        </div>
    )
}