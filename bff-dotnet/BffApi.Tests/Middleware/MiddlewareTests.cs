using BffApi.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace BffApi.Tests.Middleware;

public class RequestLoggingMiddlewareTests
{
    [Fact]
    public async Task InvokeAsync_LogsRequestAndResponse()
    {
        var logger = Substitute.For<ILogger<RequestLoggingMiddleware>>();
        var context = new DefaultHttpContext();
        context.Request.Method = "GET";
        context.Request.Path = "/api/health";

        RequestDelegate next = ctx =>
        {
            ctx.Response.StatusCode = 200;
            return Task.CompletedTask;
        };

        var middleware = new RequestLoggingMiddleware(next, logger);
        await middleware.InvokeAsync(context);

        logger.Received(1).Log(
            LogLevel.Information,
            Arg.Any<EventId>(),
            Arg.Any<object>(),
            Arg.Any<Exception?>(),
            Arg.Any<Func<object, Exception?, string>>());
    }

    [Fact]
    public async Task InvokeAsync_LogsError_WhenExceptionThrown()
    {
        var logger = Substitute.For<ILogger<RequestLoggingMiddleware>>();
        var context = new DefaultHttpContext();
        context.Request.Method = "POST";
        context.Request.Path = "/api/fail";

        RequestDelegate next = _ => throw new InvalidOperationException("Test error");

        var middleware = new RequestLoggingMiddleware(next, logger);

        await Assert.ThrowsAsync<InvalidOperationException>(() => middleware.InvokeAsync(context));

        logger.Received(1).Log(
            LogLevel.Error,
            Arg.Any<EventId>(),
            Arg.Any<object>(),
            Arg.Is<Exception?>(e => e is InvalidOperationException),
            Arg.Any<Func<object, Exception?, string>>());
    }
}

public class SecurityHeadersMiddlewareTests
{
    [Fact]
    public async Task InvokeAsync_AddsSecurityHeaders()
    {
        RequestDelegate next = ctx => Task.CompletedTask;
        var middleware = new SecurityHeadersMiddleware(next);
        var context = new DefaultHttpContext();

        await middleware.InvokeAsync(context);

        Assert.Equal("nosniff", context.Response.Headers["X-Content-Type-Options"]);
        Assert.Equal("SAMEORIGIN", context.Response.Headers["X-Frame-Options"]);
        Assert.Equal("strict-origin-when-cross-origin", context.Response.Headers["Referrer-Policy"]);
    }
}
